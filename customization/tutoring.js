﻿/*
 * Web JoinNet
 * Copyright © 2019, John Liu <john@homemeeting.com>
 * HomeMeeting Inc.
 */

(function () {
  function initModule(hmtg) {
    var customization = hmtg.customization = hmtg.customization || {};

    // customization start here

    // whether to show messenger-related functions
    customization.show_msgr = true;

    // whether to show open jnj section
    customization.show_open_jnj = true;

    // whether to show user guide 
    customization.show_user_guide = true;

    // whether to show demo link under Options
    customization.show_demo_link = false;

    // whether to show native app under Options
    customization.show_native_app = false;

    // whether to support presenter
    customization.support_presenter = false;

    // whether to support sync mode
    customization.support_sync_mode = false;

    // whether to support remote monitor mode
    customization.support_monitor_mode = true;

    // whether to capture video by default
    customization.capture_video_by_default = true;

    // whether to stop receiving audio when mute
    customization.stop_audio_when_mute = false;

    // whether to prefer controller over user's action when choosing whose audio to decode
    customization.restricted_audio_decoding_prefer_controller = false;

    // default html5 media links
    customization.media_links = [
      { name: 'The Tree of Life Trailer(cross origin, CORS)', src: 'http://www.homemeeting.com/html5/tree.mp4' },
      { audio_only: true, name: 'KQED Radio Live', src: 'http://streams.kqed.org/kqedradio' },
      { name: 'Small mp4', src: 'media/small.mp4' },
      { name: 'Small webm', src: 'media/small.webm' },
      { audio_only: true, name: 'mp3 audio', src: 'media/speaker.mp3' },
      { audio_only: true, name: 'wav audio', src: 'media/speaker.wav' },
      { name: 'Big Buck-m4v(cross origin, NO CORS)', src: 'http://broken-links.com/tests/media/BigBuck.m4v' },
      { name: 'Big Buck Bunny-mp4(cross origin, NO CORS)', src: 'http://clips.vorwaerts-gmbh.de/big_buck_bunny.mp4' }
      ];

    // ×: [u00d7]
    // ÷: [u00f7]
    // ±: [u00b1]
    // built-in mark location, must include the ending '/'
    customization.builtin_mark_location = 'img/mark/';
    // built-in marks
    customization.builtin_mark_array = [
      'apple.png',
      'star.png',
      'emoji-smile.png'
      ];

    // default unicode text mark list
    customization.unicode_text_list = [
      '←',
      '↑',
      '→',
      '↓',
      '↖',
      '↗',
      '↘',
      '↙',
      '⇐',
      '⇑',
      '⇒',
      '⇓',
      '⇖',
      '⇗',
      '⇘',
      '⇙',
      '⇌',
      '‰',
      '➕',
      '➖',
      '✖',
      '➗',
      '∀',
      '∃',
      '∅',
      '∈',
      '∉',
      '√',
      '∛',
      '∝',
      '∞',
      '∫',
      '∵',
      '∴',
      '≤',
      '≥',
      '⊂',
      '⊃',
      '⊆',
      '⊇',
      'Δ',
      'Σ',
      'Ω',
      'α',
      'β',
      'γ',
      'δ',
      'ε',
      'η',
      'θ',
      'λ',
      'μ',
      'π',
      'ρ',
      'σ',
      'τ',
      'φ',
      'ω',
      '℃',
      '℉',
      '℠',
      '™',
      '©',
      '♠',
      '♥',
      '♦',
      '♣',
      '✂',
      '✈',
      '✉',
      '✊',
      '✋',
      '✌',
      '✏',
      '🚀',
      '✨',
      '🚃',
      '✒',
      '🚄',
      '❄',
      '🚅',
      '✔',
      '✘',
      '🚇',
      '❤',
      '🚉',
      '🚌',
      '🚑',
      '🚒',
      '🚓',
      '🚕',
      '🚗',
      '🚙',
      '🚚',
      '🚢',
      '🚤',
      '🚥',
      '🚩',
      '🚲',
      '☀',
      '☁',
      '☎',
      '🌂',
      '☔',
      '☕',
      '☝',
      '♿',
      '⚡',
      '⚽',
      '⚾',
      '⛄',
      '⛅',
      '🌙',
      '🌴',
      '🌹',
      '🌻',
      '🌽',
      '🍁',
      '🍅',
      '🍆',
      '🍇',
      '🍈',
      '🍉',
      '🍌',
      '🍍',
      '🍒',
      '🍓',
      '🍚',
      '🍴',
      '🍺',
      '🎁',
      '🎂',
      '🎄',
      '🎈',
      '🎉',
      '🎼',
      '🐍',
      '🐎',
      '🐑',
      '🐒',
      '🐔',
      '🐗',
      '🐮',
      '🐯',
      '🐰',
      '🐲',
      '🐶',
      '🐷',
      '👄',
      '👌',
      '👍',
      '👎',
      '👏',
      '👦',
      '👧',
      '👨',
      '👩',
      '💔',
      '💘',
      '💤',
      '💪',
      '💰'
    ];

    // default font list
    customization.font_list = [
      'Sans Serif',
      'Microsoft Sans Serif',
      'Verdana',
      'YuGothic',
      'Hiragino Kaku Gothic ProN',
      'Meiryo'
    ];

    // default emoji list
    // http://apps.timwhitlock.info/emoji/tables/unicode
    // http://unicode.org/emoji/charts/full-emoji-list.html
    // http://www.fuhaodq.com/emoji/
    customization.emoji_list = [
      '😁',
      '😂',
      '😃',
      '😄',
      '😅',
      '😆',
      '😉',
      '😊',
      '😋',
      '😌',
      '😍',
      '😏',
      '😒',
      '😓',
      '😔',
      '😖',
      '😘',
      '😚',
      '😜',
      '😝',
      '😞',
      '😠',
      '😡',
      '😢',
      '😣',
      '😤',
      '😥',
      '😨',
      '😩',
      '😪',
      '😫',
      '😭',
      '😰',
      '😱',
      '😲',
      '😳',
      '😵',
      '😷',
      '😐',
      '🙏',
      '✂',
      '✈',
      '✉',
      '✊',
      '✋',
      '✌',
      '✏',
      '🚀',
      '✨',
      '🚃',
      '✒',
      '🚄',
      '❄',
      '🚅',
      '✔',
      '✘',
      '🚇',
      '❤',
      '🚉',
      '🚌',
      '🚑',
      '🚒',
      '🚓',
      '🚕',
      '🚗',
      '🚙',
      '🚚',
      '🚢',
      '🚤',
      '🚥',
      '🚩',
      '🚲',
      '☀',
      '☁',
      '☎',
      '🌂',
      '♠',
      '☔',
      '♣',
      '☕',
      '♥',
      '☝',
      '♦',
      '♿',
      '⚡',
      '⚽',
      '⚾',
      '⛄',
      '⛅',
      '🌙',
      '🌴',
      '🌹',
      '🌻',
      '🌽',
      '🍁',
      '🍅',
      '🍆',
      '🍇',
      '🍈',
      '🍉',
      '🍌',
      '🍍',
      '🍒',
      '🍓',
      '🍚',
      '🍴',
      '🍺',
      '🎁',
      '🎂',
      '🎄',
      '🎈',
      '🎉',
      '🎼',
      '🐍',
      '🐎',
      '🐑',
      '🐒',
      '🐔',
      '🐗',
      '🐮',
      '🐯',
      '🐰',
      '🐲',
      '🐶',
      '🐷',
      '👄',
      '👌',
      '👍',
      '👎',
      '👏',
      '👦',
      '👧',
      '👨',
      '👩',
      '💔',
      '💘',
      '💤',
      '💪',
      '💰'
    ];

    // default emoticon list
    // https://en.wikipedia.org/wiki/List_of_emoticons
    // http://www.fuhaodq.com/yanwenzi/1664.html
    // http://tieba.baidu.com/p/4236589117
    customization.emoticon_list = [
      '^_^',
      '^o^',
      '*^_^*',
      '\\(^o^)/',
      '>_<',
      'm(_ _)m',
      '*_*',
      ":'-(",
      ":'-)",
      '^5',
      '(-_-)zzz',
      '((+_+))',
      '( ^^)',
      '(=_=)',
      '>^_^<',
      '(^^)/~~~',
      '(*^^)v',
      "'}{'",
      '>:\\',
      "@}-;-'---",
      'w(ﾟДﾟ)w',
      '(ノへ￣、)',
      '(￣_,￣ )',
      'ヽ(✿ﾟ▽ﾟ)ノ',
      '(๑•̀ㅂ•́)و✧',
      '(￣ε(#￣)☆╰╮o(￣皿￣///)',
      'づ￣3￣）づ╭❤～',
      'Σ( ° △ °|||)︴',
      '(～￣(OO)￣)ブ',
      '︿(￣︶￣)︿',
      '(u‿ฺu✿ฺ)',
      '♪(^∇^*)',
      '╰(*°▽°*)╯',
      '（○｀ 3′○）',
      'o(*^＠^*)o',
      '(°ー°〃)',
      '~~( ﹁ ﹁ ) ~~~',
      '(ーー゛)',
      '（′Д`）',
      ' (。﹏。*)',
      '(*/ω＼*)',
      '┭┮﹏┭┮',
      'Ψ(￣∀￣)Ψ',
      'ヽ(*。>Д<)o゜',
      'ヾ(≧▽≦*)o',
      'φ(≧ω≦*)♪',
      'o(*￣▽￣*)o',
      '(o゜▽゜)o☆',
      '(((o(*ﾟ▽ﾟ*)o)))',
      '||ヽ(*￣▽￣*)ノミ|Ю',
      '=￣ω￣=',
      '（*＾-＾*）',
      '(⊙ˍ⊙)',
      'Ｏ(≧口≦)Ｏ',
      '╰(*°▽°*)╯',
      '(* ￣︿￣)',
      'ヽ（≧□≦）ノ',
      'o(￣ヘ￣o＃)',
      '╮（╯＿╰）╭',
      '.....((/- -)/'
    ];
  }

  if(typeof hmtg === 'undefined') hmtg = {};
  return initModule(hmtg);
})();
