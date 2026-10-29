"""生成调味的卡通水彩 SVG（糖、酱油、辣椒、花椒、醋，以及万能的高汤）。

水彩效果全部靠 SVG 滤镜：
- wc：轻微扰动边缘 + 纸张颗粒，模拟颜料在纸上的晕染
- splash：大幅扰动的背景色块，模拟随手刷的一笔底色
用法：python3 scripts/seasoning-art.py  →  写入 src/assets/seasonings/*.svg
"""
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / 'src' / 'assets' / 'seasonings'

DEFS = '''<defs>
  <filter id="wc" x="-20%" y="-20%" width="140%" height="140%">
    <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="{seed}" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feGaussianBlur in="d" stdDeviation="0.5" result="b"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="7" result="grain"/>
    <feColorMatrix in="grain" type="saturate" values="0" result="gray"/>
    <feComponentTransfer in="gray" result="paper">
      <feFuncR type="linear" slope="0.35" intercept="0.72"/>
      <feFuncG type="linear" slope="0.35" intercept="0.72"/>
      <feFuncB type="linear" slope="0.35" intercept="0.72"/>
    </feComponentTransfer>
    <feComposite in="paper" in2="b" operator="in" result="paperIn"/>
    <feBlend in="b" in2="paperIn" mode="multiply"/>
  </filter>
  <filter id="splash" x="-30%" y="-30%" width="160%" height="160%">
    <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="4" seed="{seed}" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="38" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feGaussianBlur in="d" stdDeviation="2"/>
  </filter>
</defs>'''


def face(x, y, eye='#2b1d16', gap=9, size=1.0):
    """一张小脸：两只眼睛、笑嘴、腮红。"""
    r = 3.6 * size
    return f'''
  <g class="face">
    <ellipse cx="{x - 14 * size}" cy="{y + 8 * size}" rx="{6 * size}" ry="{3.5 * size}" fill="#ff8f8f" opacity=".55"/>
    <ellipse cx="{x + 14 * size}" cy="{y + 8 * size}" rx="{6 * size}" ry="{3.5 * size}" fill="#ff8f8f" opacity=".55"/>
    <circle cx="{x - gap * size}" cy="{y}" r="{r}" fill="{eye}"/>
    <circle cx="{x + gap * size}" cy="{y}" r="{r}" fill="{eye}"/>
    <circle cx="{x - gap * size + 1.2 * size}" cy="{y - 1.3 * size}" r="{1.2 * size}" fill="#fff"/>
    <circle cx="{x + gap * size + 1.2 * size}" cy="{y - 1.3 * size}" r="{1.2 * size}" fill="#fff"/>
    <path d="M{x - 5 * size},{y + 7 * size} Q{x},{y + 12 * size} {x + 5 * size},{y + 7 * size}"
          fill="none" stroke="{eye}" stroke-width="{2.2 * size}" stroke-linecap="round"/>
  </g>'''


def svg(name, seed, splash_color, body):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img" aria-label="{name}">
{DEFS.format(seed=seed)}
  <circle cx="100" cy="108" r="72" fill="{splash_color}" opacity=".45" filter="url(#splash)"/>
  <g filter="url(#wc)" stroke-linejoin="round">
{body}
  </g>
</svg>
'''


SUGAR = '''
    <!-- 大方糖 -->
    <polygon points="58,88 100,68 142,88 100,108" fill="#ffffff" stroke="#8a9bb0" stroke-width="2.5"/>
    <polygon points="58,88 100,108 100,156 58,136" fill="#eef2f8" stroke="#8a9bb0" stroke-width="2.5"/>
    <polygon points="100,108 142,88 142,136 100,156" fill="#d3ddea" stroke="#8a9bb0" stroke-width="2.5"/>
    <path d="M70,90 L98,77" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".9"/>
    <!-- 小方糖 -->
    <polygon points="128,140 150,129 172,140 150,151" fill="#ffffff" stroke="#8a9bb0" stroke-width="2.2"/>
    <polygon points="128,140 150,151 150,175 128,164" fill="#eef2f8" stroke="#8a9bb0" stroke-width="2.2"/>
    <polygon points="150,151 172,140 172,164 150,175" fill="#d3ddea" stroke="#8a9bb0" stroke-width="2.2"/>
    <!-- 糖粒 -->
    <rect x="40" y="150" width="7" height="7" fill="#fff" stroke="#9fb0c4" stroke-width="1.5" transform="rotate(20 43 153)"/>
    <rect x="52" y="164" width="5" height="5" fill="#fff" stroke="#9fb0c4" stroke-width="1.5" transform="rotate(-15 54 166)"/>
    <rect x="112" y="170" width="6" height="6" fill="#fff" stroke="#9fb0c4" stroke-width="1.5" transform="rotate(35 115 173)"/>
''' + face(79, 121, size=1.1)

SOY = '''
    <!-- 瓶身 -->
    <path d="M88,46 L112,46 L112,70 C112,82 138,88 138,104 L138,168 Q138,180 126,180 L74,180 Q62,180 62,168 L62,104 C62,88 88,82 88,70 Z"
          fill="#4a2a1a" stroke="#2a160c" stroke-width="2.5"/>
    <path d="M70,104 L70,160" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".35"/>
    <path d="M95,52 L95,72" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".35"/>
    <!-- 红盖子 -->
    <rect x="85" y="28" width="30" height="20" rx="5" fill="#d64236" stroke="#8f2219" stroke-width="2.5"/>
    <path d="M90,34 L110,34" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".5"/>
    <!-- 标签 -->
    <rect x="70" y="110" width="60" height="54" rx="9" fill="#fff4dc" stroke="#b48a52" stroke-width="2"/>
''' + face(100, 129, size=1.1) + '''
    <text x="100" y="158" text-anchor="middle" font-size="11" font-weight="700" fill="#8f2219"
          font-family="'PingFang SC','Microsoft YaHei',sans-serif">酱油</text>
'''

CHILI = '''
    <!-- 辣椒身体 -->
    <path d="M62,70 C38,96 54,150 114,172 C138,181 162,177 160,166 C158,157 141,160 128,152 C105,137 98,112 100,86 C102,64 80,55 62,70 Z"
          fill="#dc3b2c" stroke="#8f2219" stroke-width="2.5"/>
    <path d="M58,96 C56,118 66,138 84,152" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".4"/>
    <!-- 蒂和柄 -->
    <path d="M56,74 C58,58 80,50 100,62 C93,72 72,77 56,74 Z" fill="#5b9a3f" stroke="#2f5f22" stroke-width="2.2"/>
    <path d="M80,60 C79,46 88,35 102,30" fill="none" stroke="#3e6f30" stroke-width="6" stroke-linecap="round"/>
''' + face(77, 106, size=1.1)

PEPPERCORN = '''
    <!-- 枝和叶 -->
    <path d="M100,34 C100,58 99,78 100,96" fill="none" stroke="#5b4a2a" stroke-width="4" stroke-linecap="round"/>
    <path d="M100,56 C80,34 54,40 42,56 C58,68 84,68 100,56 Z" fill="#86bb55" stroke="#3f6a26" stroke-width="2.2"/>
    <path d="M48,56 C64,56 82,56 96,56" stroke="#3f6a26" stroke-width="1.5" fill="none" opacity=".7"/>
    <path d="M100,62 C120,40 148,44 160,60 C142,72 116,72 100,62 Z" fill="#7aae4c" stroke="#3f6a26" stroke-width="2.2"/>
    <path d="M106,62 C122,61 140,61 154,60" stroke="#3f6a26" stroke-width="1.5" fill="none" opacity=".7"/>
    <!-- 花椒粒 -->
    <g stroke="#2f5f22" stroke-width="2">
      <circle cx="74" cy="104" r="16" fill="#5f9e40"/>
      <circle cx="128" cy="102" r="16" fill="#5f9e40"/>
      <circle cx="64" cy="138" r="15" fill="#4f8c34"/>
      <circle cx="138" cy="136" r="15" fill="#4f8c34"/>
      <circle cx="80" cy="166" r="14" fill="#4f8c34"/>
      <circle cx="122" cy="166" r="14" fill="#4f8c34"/>
      <circle cx="100" cy="130" r="26" fill="#69aa48"/>
    </g>
    <g fill="#2f5f22" opacity=".55">
      <circle cx="70" cy="98" r="1.8"/><circle cx="80" cy="108" r="1.6"/><circle cx="68" cy="110" r="1.4"/>
      <circle cx="124" cy="96" r="1.8"/><circle cx="134" cy="106" r="1.6"/>
      <circle cx="60" cy="134" r="1.6"/><circle cx="68" cy="144" r="1.5"/>
      <circle cx="142" cy="132" r="1.6"/><circle cx="134" cy="142" r="1.5"/>
      <circle cx="78" cy="162" r="1.5"/><circle cx="124" cy="170" r="1.5"/>
      <circle cx="84" cy="122" r="1.6"/><circle cx="116" cy="146" r="1.6"/><circle cx="114" cy="116" r="1.4"/>
    </g>
    <g fill="#fff" opacity=".45">
      <circle cx="68" cy="98" r="4"/><circle cx="122" cy="96" r="4"/><circle cx="88" cy="114" r="6"/>
    </g>
''' + face(100, 130, size=1.15)

VINEGAR = '''
    <!-- 醋坛子 -->
    <path d="M72,72 C48,92 46,150 70,172 Q100,186 130,172 C154,150 152,92 128,72 Z"
          fill="#3d6dab" stroke="#1f3f74" stroke-width="2.5"/>
    <path d="M62,108 C60,128 64,146 74,160" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".35"/>
    <rect x="76" y="60" width="48" height="16" rx="6" fill="#2f5d9e" stroke="#1f3f74" stroke-width="2.2"/>
    <!-- 封口布 + 红绳 -->
    <path d="M68,62 C70,36 130,36 132,62 Q100,72 68,62 Z" fill="#f1e2c4" stroke="#b48a52" stroke-width="2.2"/>
    <path d="M72,61 Q100,70 128,61" fill="none" stroke="#d64236" stroke-width="4" stroke-linecap="round"/>
    <path d="M126,62 C134,70 136,78 132,84 M126,62 C122,72 124,80 128,84" fill="none" stroke="#d64236" stroke-width="3" stroke-linecap="round"/>
    <!-- 红纸菱形标签 -->
    <polygon points="100,84 120,104 100,124 80,104" fill="#d9433a" stroke="#8f2219" stroke-width="2"/>
    <text x="100" y="110" text-anchor="middle" font-size="16" font-weight="800" fill="#fff4dc"
          font-family="'PingFang SC','Microsoft YaHei',sans-serif">醋</text>
''' + face(100, 147, eye='#14233d', size=1.1)

STOCK = '''
    <!-- 热气 -->
    <g fill="none" stroke="#c9b48a" stroke-width="4" stroke-linecap="round" opacity=".8">
      <path d="M78,52 C70,42 86,34 78,22"/>
      <path d="M100,46 C92,34 108,26 100,12"/>
      <path d="M122,52 C114,42 130,34 122,22"/>
    </g>
    <!-- 锅盖 -->
    <path d="M52,80 C56,58 144,58 148,80 Z" fill="#e2b13c" stroke="#8a6418" stroke-width="2.5"/>
    <ellipse cx="100" cy="58" rx="11" ry="7" fill="#c8372d" stroke="#8f2219" stroke-width="2.2"/>
    <path d="M70,72 C80,66 96,64 110,65" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".5"/>
    <!-- 锅身 -->
    <rect x="44" y="78" width="112" height="12" rx="6" fill="#c9952a" stroke="#8a6418" stroke-width="2.5"/>
    <path d="M52,90 L148,90 C150,138 136,170 100,172 C64,170 50,138 52,90 Z" fill="#e8b84a" stroke="#8a6418" stroke-width="2.5"/>
    <path d="M62,100 C62,126 70,146 84,158" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".4"/>
    <!-- 把手 -->
    <path d="M52,98 C34,96 32,118 50,118" fill="none" stroke="#8a6418" stroke-width="6" stroke-linecap="round"/>
    <path d="M148,98 C166,96 168,118 150,118" fill="none" stroke="#8a6418" stroke-width="6" stroke-linecap="round"/>
''' + face(100, 128, size=1.15)

ART = {
    'sugar':      ('糖',   11, '#f7d6dd', SUGAR),
    'soy':        ('酱油', 23, '#e8c9a8', SOY),
    'chili':      ('辣椒', 5,  '#ffc9b8', CHILI),
    'peppercorn': ('花椒', 31, '#d4ebbf', PEPPERCORN),
    'vinegar':    ('醋',   17, '#c6d9f0', VINEGAR),
    'stock':      ('高汤', 41, '#f6e3b0', STOCK),
}

if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    for key, (name, seed, splash, body) in ART.items():
        (OUT / f'{key}.svg').write_text(svg(name, seed, splash, body), encoding='utf-8')
        print(f'wrote {OUT / key}.svg')
