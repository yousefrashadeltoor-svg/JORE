import os
import re
import sys
import time
import uuid
import shutil
import threading
from pathlib import Path
from urllib.parse import urlparse
from flask import Flask, request, jsonify, send_file, abort, make_response
import yt_dlp

ROOT = Path(__file__).resolve().parent
TEMP_ROOT = Path(os.environ.get('TMPDIR', '/tmp')) / 'flux-downloads'
TEMP_ROOT.mkdir(parents=True, exist_ok=True)
app = Flask(__name__, static_folder='.', static_url_path='')
app.config['MAX_CONTENT_LENGTH'] = 64 * 1024
JOBS = {}
JOBS_LOCK = threading.Lock()
MAX_JOBS = int(os.environ.get('FLUX_MAX_JOBS', '2'))
MAX_OUTPUT_MB = int(os.environ.get('FLUX_MAX_OUTPUT_MB', '450'))


def valid_url(url):
    if not isinstance(url, str) or len(url) > 4096:
        return False
    try:
        p = urlparse(url)
        return p.scheme in ('http', 'https') and bool(p.hostname) and not any(c in url for c in ('\n', '\r', '\x00'))
    except Exception:
        return False


def safe_name(name):
    name = re.sub(r'[\\/:*?"<>|\x00-\x1f]', '_', str(name or 'media'))
    name = re.sub(r'\s+', ' ', name).strip(' .')
    return (name[:150] or 'media')


def base_options():
    return {
        'quiet': True,
        'no_warnings': True,
        'noplaylist': True,
        'ignoreerrors': False,
        'socket_timeout': 20,
        'retries': 2,
        'fragment_retries': 2,
        'cachedir': False,
        'extractor_retries': 1,
        'logger': None,
    }


def error_message(exc):
    msg = str(exc or 'Unknown error')
    # Avoid exposing local paths, tracebacks, or command details to the client.
    if 'Unsupported URL' in msg:
        return 'الموقع أو الرابط غير مدعوم حاليًا بواسطة yt-dlp.'
    if 'Private video' in msg or 'This video is private' in msg:
        return 'الفيديو خاص أو لا يملك الخادم صلاحية الوصول إليه.'
    if 'Sign in' in msg or 'login' in msg.lower() or 'authentication' in msg.lower():
        return 'المصدر يتطلب تسجيل دخول أو صلاحية غير متاحة لهذا التطبيق.'
    return 'تعذر معالجة الرابط. جرّب رابطًا عامًا آخر أو راجع سجل الخادم للتفاصيل.'



@app.after_request
def add_cors_headers(response):
    origin = request.headers.get('Origin')
    allowed = os.environ.get('FRONTEND_ORIGIN', '').strip().rstrip('/')
    if origin and allowed and origin.rstrip('/') == allowed:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Vary'] = 'Origin'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response

@app.route('/api/<path:unused>', methods=['OPTIONS'])
def api_options(unused):
    return ('', 204)

@app.get('/')
def index():
    return app.send_static_file('index.html')


@app.get('/api/health')
def health():
    return jsonify({'ok': True, 'engine': 'yt-dlp', 'version': yt_dlp.version.__version__, 'ffmpeg': bool(shutil.which('ffmpeg'))})


@app.post('/api/info')
def info():
    data = request.get_json(silent=True) or {}
    url = data.get('url', '')
    if not valid_url(url):
        return jsonify({'error': 'الرابط غير صالح. استخدم رابط HTTP أو HTTPS.'}), 400
    try:
        opts = base_options()
        opts.update({'skip_download': True, 'extract_flat': False, 'format': 'best'})
        with yt_dlp.YoutubeDL(opts) as ydl:
            item = ydl.extract_info(url, download=False)
        if not item:
            raise RuntimeError('No media metadata returned')
        formats = []
        for f in item.get('formats') or []:
            formats.append({k: f.get(k) for k in ('format_id','format','format_note','ext','width','height','fps','filesize','filesize_approx','vcodec','acodec','tbr','abr','asr','audio_channels','protocol') if f.get(k) is not None})
        # Include a single-format entry for extractors that expose only top-level format metadata.
        if not formats and item.get('format_id'):
            formats = [{k: item.get(k) for k in ('format_id','format','format_note','ext','width','height','fps','filesize','filesize_approx','vcodec','acodec','tbr','abr','asr','audio_channels','protocol') if item.get(k) is not None}]
        result = {
            'id': item.get('id'), 'title': item.get('title'), 'thumbnail': item.get('thumbnail'),
            'duration': item.get('duration'), 'uploader': item.get('uploader'), 'channel': item.get('channel'),
            'creator': item.get('creator'), 'extractor': item.get('extractor'), 'extractor_key': item.get('extractor_key'),
            'webpage_url': item.get('webpage_url') or url, 'formats': formats,
            'preview_url': next((f.get('url') for f in reversed(item.get('formats') or []) if f.get('url') and f.get('vcodec') not in (None, 'none') and f.get('protocol') in ('https', 'http')), None),
        }
        return jsonify(result)
    except Exception as exc:
        app.logger.warning('yt-dlp info failed: %s', exc)
        return jsonify({'error': error_message(exc)}), 422


def progress_hook(job_id):
    def hook(d):
        with JOBS_LOCK:
            job = JOBS.get(job_id)
            if not job or job.get('cancel_event').is_set():
                raise yt_dlp.utils.DownloadError('Download cancelled')
            status = d.get('status')
            if status == 'downloading':
                total = d.get('total_bytes') or d.get('total_bytes_estimate')
                downloaded = d.get('downloaded_bytes')
                job.update({'status': 'downloading', 'downloaded_bytes': downloaded, 'total_bytes': total,
                            'speed': d.get('speed'), 'eta': d.get('eta'),
                            'progress': (min(99.5, downloaded * 100 / total) if downloaded is not None and total else job.get('progress', 0)),
                            'message': 'Downloading media'})
            elif status == 'finished':
                job.update({'status': 'processing', 'progress': max(job.get('progress', 0), 99), 'message': 'Finalizing output'})
    return hook


def run_download(job_id, payload, job_dir):
    with JOBS_LOCK:
        JOBS[job_id]['status'] = 'downloading'
    try:
        fmt_id = str(payload.get('format_id') or '')
        if not re.fullmatch(r'[A-Za-z0-9._+-]{1,80}', fmt_id):
            raise ValueError('Invalid format id')
        kind = payload.get('kind') if payload.get('kind') in ('video', 'audio') else 'video'
        container = payload.get('container') if payload.get('container') in ('auto','mp4','mkv','webm','source','mp3','m4a','wav','flac','opus') else 'auto'
        opts = base_options()
        opts.update({
            'format': (fmt_id if payload.get('kind') == 'audio' or payload.get('has_audio', True) else f'{fmt_id}+bestaudio/best'),
            'outtmpl': str(job_dir / '%(title).150B [%(id)s].%(ext)s'),
            'noplaylist': True,
            'continuedl': True,
            'overwrites': True,
            'progress_hooks': [progress_hook(job_id)],
            'max_filesize': MAX_OUTPUT_MB * 1024 * 1024,
            'windowsfilenames': True,
        })
        if kind == 'audio':
            # Preserve the chosen source audio stream unless the user explicitly asks for a conversion.
            opts['format'] = fmt_id
        if kind == 'video' and container in ('mp4','mkv','webm'):
            opts['merge_output_format'] = container
        if kind == 'audio' and container in ('mp3','m4a','wav','flac','opus'):
            opts['postprocessors'] = [{'key': 'FFmpegExtractAudio', 'preferredcodec': container}]
        if payload.get('subtitles') == 'all':
            opts.update({'writesubtitles': True, 'writeautomaticsub': True, 'subtitleslangs': ['all']})
            if payload.get('embed_subtitles'):
                opts['embedsubtitles'] = True
        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.download([payload['url']])
        files = [p for p in job_dir.iterdir() if p.is_file() and not p.name.endswith(('.part','.ytdl'))]
        if not files:
            raise RuntimeError('Download completed without an output file')
        output = max(files, key=lambda p: p.stat().st_size)
        size = output.stat().st_size
        if size > MAX_OUTPUT_MB * 1024 * 1024:
            raise RuntimeError('Output exceeded configured limit')
        with JOBS_LOCK:
            job = JOBS[job_id]
            job.update({'status':'completed','progress':100,'downloaded_bytes':size,'total_bytes':size,'speed':None,'eta':0,
                        'message':'Ready to download','output':str(output),'filename':output.name,'completed_at':time.time()})
    except Exception as exc:
        cancelled = False
        with JOBS_LOCK:
            job = JOBS.get(job_id)
            cancelled = bool(job and job['cancel_event'].is_set())
            if job:
                job.update({'status':'cancelled' if cancelled else 'failed','error': 'تم إلغاء التنزيل.' if cancelled else error_message(exc), 'message':'Cancelled' if cancelled else 'Failed'})
        app.logger.warning('download job %s failed: %s', job_id, exc)


@app.post('/api/download')
def download():
    data = request.get_json(silent=True) or {}
    url = data.get('url', '')
    if not valid_url(url):
        return jsonify({'error':'الرابط غير صالح.'}), 400
    fmt_id = str(data.get('format_id') or '')
    if not re.fullmatch(r'[A-Za-z0-9._+-]{1,80}', fmt_id):
        return jsonify({'error':'صيغة التنزيل المختارة غير صالحة.'}), 400
    with JOBS_LOCK:
        active = sum(1 for j in JOBS.values() if j['status'] in ('queued','downloading','processing'))
        if active >= MAX_JOBS:
            return jsonify({'error':'الخادم مشغول حاليًا. انتظر انتهاء تنزيل آخر ثم حاول مجددًا.'}), 429
        job_id = uuid.uuid4().hex
        job_dir = TEMP_ROOT / job_id
        job_dir.mkdir(parents=True, exist_ok=True)
        JOBS[job_id] = {'job_id':job_id,'status':'queued','progress':0,'title':safe_name(data.get('title') or 'Preparing media'),'downloaded_bytes':0,'total_bytes':None,'speed':None,'eta':None,'message':'Queued','created_at':time.time(),'cancel_event':threading.Event(),'output':None,'error':None,'dir':str(job_dir)}
    thread = threading.Thread(target=run_download, args=(job_id, data, job_dir), daemon=True)
    thread.start()
    return jsonify({'job_id':job_id}), 202


@app.get('/api/status/<job_id>')
def status(job_id):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if not job:
            return jsonify({'error':'مهمة التنزيل غير موجودة أو انتهت صلاحيتها.'}), 404
        result = {k:job.get(k) for k in ('job_id','status','progress','title','downloaded_bytes','total_bytes','speed','eta','message','error','filename')}
        if job.get('status') == 'completed' and job.get('output') and Path(job['output']).is_file():
            result['download_url'] = f"/api/file/{job_id}"
        elif job.get('status') == 'completed' and not (job.get('output') and Path(job['output']).is_file()):
            result.update({'status':'failed','error':'انتهت صلاحية الملف المؤقت. أعد التنزيل.'})
        return jsonify(result)


@app.get('/api/file/<job_id>')
def file(job_id):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        path = Path(job['output']) if job and job.get('output') else None
        filename = job.get('filename') if job else None
    if not path or not path.is_file():
        return jsonify({'error':'الملف غير متاح أو انتهت صلاحيته.'}), 404
    return send_file(path, as_attachment=True, download_name=filename or safe_name(path.name), conditional=True, max_age=0)


@app.post('/api/cancel/<job_id>')
def cancel(job_id):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if not job:
            return jsonify({'error':'مهمة التنزيل غير موجودة.'}), 404
        if job['status'] in ('completed','failed','cancelled'):
            return jsonify({'error':'المهمة انتهت بالفعل.'}), 409
        job['cancel_event'].set()
        job.update({'status':'cancelled','message':'Cancelled','error':'تم إلغاء التنزيل.'})
        result = {k:job.get(k) for k in ('job_id','status','progress','title','downloaded_bytes','total_bytes','speed','eta','message','error')}
    return jsonify(result)


@app.get('/style.css')
def css():
    return app.send_static_file('style.css')


@app.get('/script.js')
def js():
    return app.send_static_file('script.js')


if __name__ == '__main__':
    port = int(os.environ.get('PORT', '8000'))
    app.run(host='0.0.0.0', port=port, threaded=True)
