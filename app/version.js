/*
 * Web JoinNet
 * Copyright © 2019, John Liu <john@homemeeting.com>
 * HomeMeeting Inc.
 */

hmtg.config.APP_VERSION = '2.2.2.69d';
window.g_exempted_error = 0;
var elem;

elem = document.getElementById("error_button1");
if(elem) elem.onclick = function() {
  var target = document.getElementById("error_text");
  if(!target) return;
  var array = hmtg.util.error_array;
  if(!array.length) return;
  var text = '';
  var i;
  for(i = 0; i < array.length; i++) {
    var prefix = array[i].time.toString().replace(/(GMT.*)/, "");
    text += '#' + (i + 1) + ', ' + prefix + ' ' + array[i].text + '\n';
  }
  text += '\n------------------------------\n' + 'Total Error: ' + array.length + '\n';
  text += (new Date()).toString().replace(/(GMT.*)/, "") + '\n';
  text += 'appid=' + hmtg.util.app_id + '\n';
  text += 'Browser Information: ' + navigator.userAgent + '\n';
  if(hmtg.jnkernel && hmtg.jnkernel.version) text += "hmtg jnkernel version " + hmtg.jnkernel.version() + '\n';
  if(hmtg.jmkernel && hmtg.jmkernel.version) text += "hmtg jmkernel version " + hmtg.jmkernel.version() + '\n';
  text += "Web JoinNet version " + hmtg.config.APP_VERSION + '\n';
  text += "webapp href: " + window.location.href + '\n';
  target.textContent = text;
  target.style.display = '';
  hmtg.util.selectText(target);
  elem = document.getElementById("error_button1");
  if(elem) elem.style.display = 'none';
  elem = document.getElementById("error_button2");
  if(elem) elem.style.display = '';
}

elem = document.getElementById("error_button2");
if(elem) elem.onclick = function() {
  var target = document.getElementById("error_text");
  if(!target) return;
  target.style.display = 'none';
  elem = document.getElementById("error_button2");
  if(elem) elem.style.display = 'none';
  elem = document.getElementById("error_button1");
  if(elem) elem.style.display = '';
}

elem = document.getElementById("log_button1");
if(elem) elem.onclick = function() {
  var target = document.getElementById("log_text");
  if(!target) return;
  target.textContent = hmtg.util.read_hmtg_log();
  if(typeof target.textContent !== 'string') target.textContent = '';
  target.style.display = '';
  hmtg.util.selectText(target);
  elem = document.getElementById("log_button1");
  if(elem) elem.style.display = 'none';
  elem = document.getElementById("log_button2");
  if(elem) elem.style.display = '';
}

elem = document.getElementById("log_button2");
if(elem) elem.onclick = function() {
  var target = document.getElementById("log_text");
  if(!target) return;
  target.style.display = 'none';
  elem = document.getElementById("log_button2");
  if(elem) elem.style.display = 'none';
  elem = document.getElementById("log_button1");
  if(elem) elem.style.display = '';
}

hmtg.util.log("Web JoinNet version " + hmtg.config.APP_VERSION);
