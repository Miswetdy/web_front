import os
import sys
import subprocess
import signal
import time
from pathlib import Path
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Запускает Django backend и React frontend одновременно'

    def __init__(self):
        super().__init__()
        self.processes = []

    def add_arguments(self, parser):
        parser.add_argument(
            '--port',
            type=int,
            default=8000,
            help='Порт для Django сервера (по умолчанию: 8000)',
        )
        parser.add_argument(
            '--frontend-port',
            type=int,
            default=3000,
            help='Порт для React frontend (по умолчанию: 3000)',
        )

    def signal_handler(self, sig, frame):
        self.stdout.write(self.style.WARNING('\n\nОстановка всех серверов...'))
        for process in self.processes:
            if process.poll() is None:
                if sys.platform == 'win32':
                    process.terminate()
                else:
                    process.send_signal(signal.SIGTERM)
        time.sleep(1)
        for process in self.processes:
            if process.poll() is None:
                process.kill()
        sys.exit(0)

    def handle(self, *args, **options):
        django_port = options['port']
        frontend_port = options['frontend_port']
        
        script_path = Path(__file__).resolve()
        base_dir = script_path.parent.parent.parent.parent
        frontend_dir = base_dir / 'frontend'
        
        manage_py_candidates = [
            base_dir / 'HistoryCheckWebSite' / 'manage.py',
            base_dir.parent / 'HistoryCheckWebSite' / 'manage.py',
        ]
        
        manage_py = None
        for candidate in manage_py_candidates:
            if candidate.exists():
                manage_py = candidate
                break
        
        if not manage_py:
            manage_py = base_dir / 'HistoryCheckWebSite' / 'manage.py'
        
        if not frontend_dir.exists():
            self.stdout.write(
                self.style.ERROR(f'Директория frontend не найдена: {frontend_dir}')
            )
            return
        
        if not manage_py.exists():
            self.stdout.write(
                self.style.ERROR(f'manage.py не найден: {manage_py}')
            )
            return
        
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)
        
        self.stdout.write(self.style.SUCCESS('\n=== Запуск серверов ===\n'))
        self.stdout.write(f'Django backend: http://localhost:{django_port}')
        self.stdout.write(f'React frontend: http://localhost:{frontend_port}\n')
        self.stdout.write('Для остановки нажмите Ctrl+C\n')
        
        try:
            os.chdir(str(manage_py.parent))
            django_process = subprocess.Popen(
                [sys.executable, str(manage_py), 'runserver', f'0.0.0.0:{django_port}'],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1
            )
            self.processes.append(django_process)
            
            os.chdir(str(frontend_dir))
            env = os.environ.copy()
            env['PORT'] = str(frontend_port)
            env['BROWSER'] = 'none'
            
            if sys.platform == 'win32':
                frontend_process = subprocess.Popen(
                    ['npm.cmd', 'start'],
                    env=env,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1
                )
            else:
                frontend_process = subprocess.Popen(
                    ['npm', 'start'],
                    env=env,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1
                )
            self.processes.append(frontend_process)
            
            def print_output(process, prefix):
                for line in iter(process.stdout.readline, ''):
                    if line:
                        self.stdout.write(f'[{prefix}] {line}', ending='')
            
            import threading
            django_thread = threading.Thread(
                target=print_output, 
                args=(django_process, 'Django'),
                daemon=True
            )
            frontend_thread = threading.Thread(
                target=print_output,
                args=(frontend_process, 'Frontend'),
                daemon=True
            )
            
            django_thread.start()
            frontend_thread.start()
            
            while True:
                if django_process.poll() is not None:
                    self.stdout.write(self.style.ERROR('\nDjango сервер остановлен'))
                    break
                if frontend_process.poll() is not None:
                    self.stdout.write(self.style.ERROR('\nFrontend сервер остановлен'))
                    break
                time.sleep(1)
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'\nОшибка: {e}'))
            self.signal_handler(None, None)

