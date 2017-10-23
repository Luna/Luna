#!/usr/bin/env python3

import os
import shutil
import subprocess

from .utils import prep_path, working_directory, log_msg


shell_path = prep_path('../shell')
luna_binary_path = prep_path('../dist/bin/public/luna')
config_env_path = prep_path('../dist/config/env')
stdlib_path = prep_path('../stdlib')


def create_dirs():
    log_msg('Making sure that all the directories exist')
    os.makedirs(luna_binary_path, exist_ok=True)
    os.makedirs(config_env_path, exist_ok=True)


def build():
    log_msg('Running the stack build...')
    with working_directory(shell_path):
        subprocess.check_output(['stack', 'build', '--copy-bins'])


def link_main_bin():
    log_msg('Creating a symbolic link for the luna binary')
    with working_directory(prep_path('../dist/bin')):
        if os.path.exists('main'):
            os.remove('main')
        os.symlink('./public/luna', 'main', target_is_directory=True)


def copy_stdlib():
    src = os.path.join(stdlib_path, "Std")
    dst = os.path.join(config_env_path, "Std")
    log_msg('Copying stdlib from {} to {}'.format(src, dst))
    if os.path.exists(dst):
        shutil.rmtree(dst)
    shutil.copytree(src, dst)


def run():
    create_dirs()
    build()
    link_main_bin()
    copy_stdlib()


if __name__ == '__main__':
    run()
