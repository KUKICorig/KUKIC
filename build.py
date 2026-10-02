#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Сборщик Mindustry Studio из исходников src/ в один self-contained HTML-файл.

Структура исходников:
  src/head.html          -- <head> (мета, ранний script раскладки) + начало <body>
  src/css/main.css       -- все стили
  src/body.html          -- вся HTML-разметка страницы
  src/js-boot.js         -- обёртка IIFE + обработчик ошибок запуска
  src/js/*.js            -- части основного скрипта (в алфавитном порядке!)
  dist/                  -- сюда кладётся результат

Использование:
  python3 build.py                 -- собрать dist/mindustry-studio-KUKIC-v2.9.9w.html
  python3 build.py --check         -- только проверка синтаксиса (node --check)
  python3 build.py --open          -- собрать и открыть в браузере

Принцип: файлы src/js/*.js склеиваются по алфавиту (01-, 02-, ...) внутрь
асинхронной IIFE из src/js-boot.js. Порядок файлов ВАЖЕН — не переименовывайте
префиксы без необходимости.
"""
import argparse
import glob
import os
import subprocess
import sys
import webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src")
DIST = os.path.join(ROOT, "dist")
OUT_NAME = "mindustry-studio-KUKIC-v2.9.9w.html"


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def js_parts():
    return sorted(glob.glob(os.path.join(SRC, "js", "*.js")))


def build_script_js():
    """Собирает содержимое главного <script> из js-boot.js + частей."""
    boot = read(os.path.join(SRC, "js-boot.js"))
    parts = js_parts()
    if not parts:
        sys.exit("Ошибка: не найдены файлы в src/js/")
    body = "\n".join(read(p).rstrip("\n") for p in parts)
    # В boot есть маркер /*__APP_JS__*/ — заменяем его на склейку частей.
    marker = "/*__APP_JS__*/"
    if marker not in boot:
        sys.exit("Ошибка: в src/js-boot.js нет маркера %s" % marker)
    # Заменяем ТОЛЬКО строку с маркером (иначе подстрока маркера может
    # встретиться в комментарии и весь boot-код вставится внутрь скрипта).
    out_lines = []
    replaced = False
    for line in boot.split("\n"):
        if not replaced and line.strip() == marker:
            out_lines.append(body)
            replaced = True
        else:
            out_lines.append(line)
    if not replaced:
        sys.exit("Ошибка: маркер %s не найден на отдельной строке в src/js-boot.js" % marker)
    return "\n".join(out_lines)


def build_html():
    # src/head.html: <head> (мета + ранний script раскладки), <link> на css,
    # тег jszip CDN и закрывающие </head><body>.
    # Итоговый файл делаем самодостаточным: вместо внешней ссылки на CSS
    # подставляем инлайн-блок <style> (файл можно открывать двойным кликом).
    head = read(os.path.join(SRC, "head.html")).rstrip("\n")
    css = read(os.path.join(SRC, "css", "main.css")).rstrip("\n")
    body_html = read(os.path.join(SRC, "body.html")).rstrip("\n")
    app_js = build_script_js()

    style_block = "\n  <style>\n%s\n  </style>\n" % css
    link_tag = '  <link rel="stylesheet" href="css/main.css">'
    if link_tag in head:
        head = head.replace(link_tag, style_block.strip("\n"), 1)
    elif "</head>" in head:
        head = head.replace("</head>", style_block + "</head>", 1)
    else:
        sys.exit("Ошибка: в src/head.html нет ни ссылки на css, ни </head>")

    html = "\n".join([
        head,
        "",
        body_html,
        "",
        "  <script>",
        app_js,
        "</script>",
        "</body>",
        "</html>",
        "",
    ])
    return html


def check_syntax(html):
    """Достаёт главный <script> и проверяет его через node --check (если есть node)."""
    start = html.rindex("<script>\n") + len("<script>\n")
    end = html.rindex("</script>")
    js = html[start:end]
    # .mjs — чтобы node --check трактовал код как ES-модуль и разрешал
    # top-level await (он встречается внутри async-IIFE в некоторых частях).
    tmp = os.path.join(DIST, "_check.mjs")
    os.makedirs(DIST, exist_ok=True)
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(js)
    try:
        r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True)
        ok = r.returncode == 0
        print(("OK: синтаксис главного скрипта корректен (%d строк)"
               % js.count("\n")) if ok else "ОШИБКА СИНТАКСИСА:\n" + r.stderr)
        os.remove(tmp)
        return ok
    except FileNotFoundError:
        print("node не найден — пропущена проверка синтаксиса")
        return True


def main():
    ap = argparse.ArgumentParser(description="Сборка Mindustry Studio из src/")
    ap.add_argument("--check", action="store_true", help="только проверка синтаксиса")
    ap.add_argument("--open", action="store_true", help="открыть результат в браузере")
    args = ap.parse_args()

    html = build_html()

    if args.check:
        sys.exit(0 if check_syntax(html) else 1)

    os.makedirs(DIST, exist_ok=True)
    out = os.path.join(DIST, OUT_NAME)
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write(html)

    if not check_syntax(html):
        sys.exit(1)

    print("Собрано: %s (%d КБ, %d строк)" % (
        os.path.relpath(out, ROOT), len(html.encode("utf-8")) // 1024,
        html.count("\n")))

    if args.open:
        webbrowser.open("file://" + out)


if __name__ == "__main__":
    main()
