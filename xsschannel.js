/**
 * ==============================================================================
 * The MIT License
 * 
 * Copyright (c) 209 misko@hevery.com
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 * ==============================================================================
 */

(function(){
  var PREFIX = "$XSS$";
  var globalWindow = window;
  xsschannel = {};
  var xssMessageListener = function(){};
  function parseHref(href) {
    var match = href.match(/^(.*)#\$XSS\$:(.*):(.*):(.*)$/);
    return match ? {url:match[1], i:match[2], n:match[3], msg:decodeURIComponent(match[4])} : false;
  }

  function watchURL(window){
    var location = window.location;
    var last = location.href;
    function pull(){
      var href = location.href;
      if (last != href) {
        var hash = parseHref(href);
        if (hash) {
          if (xssMessageListener(hash.i, hash.n, hash.msg)) {
            window.history.back();
          } else {
            location.href = last;
          }
        }
        last = location.href;
      }
      window.setTimeout(pull, 20);
    };
    pull();
  }
  
  function channel(setHref, callback, window, rollback) {
    watchURL(window);
    xssMessageListener = function(i, n, part){
      if (i==0 && n==0 && part == "ACK") {
      } else {
        callback(part);
        setHref(0, 0, "ACK");
      }
      return rollback;
    };
    return function sendFn (msg){
      setHref(1, 1, msg);
    };
  }
  
  xsschannel.connect = function (url, callback, window) {
    window = window || globalWindow;
    var iframe = document.createElement("iframe");
    function setHref(i , n , msg) {
      iframe.src  = [url + "#" + PREFIX, i , n, encodeURIComponent(msg)].join(":");
    }
    setHref(0,0,window.location.href.split('#')[0]);
    var send = channel(setHref, callback, window, true);
    send.iframe = iframe;
    send.url = iframe.src.split("#")[0];
    return send;
  };
  
  xsschannel.listen = function(callback, window){
    window = window || globalWindow;
    var href = parseHref(window.location.href);
    if (!href) throw "Window not loaded as an iframe of xsschannel";
    var baseUrl = href.msg + "#" + PREFIX;
    function setHref(i , n , msg) {
      window.parent.location.href  = [baseUrl, i , n, encodeURIComponent(msg)].join(":");
    }
    window.location.href = href.url + "#";
    var send = channel(setHref, callback, window, true);
    send.url = href.msg;
    return send;
  };
  
})();
