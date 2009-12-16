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
  function isXssMsg(hash) {return hash.substr(1, PREFIX.length) == PREFIX;}

  function watchURL(window){
    var last = "";
    function pull(){
      var hash = window.location.hash;
      if (last != hash) {
        if (isXssMsg(hash)) {
          var parts = hash.split(':');
          if (xssMessageListener(parts[1], parts[2], parts[3])) {
            window.history.go(-1);
          } else {
            window.location.hash = last;
          }
        } else {
          last = hash;
        }
      }
      window.setTimeout(pull, 50);
    };
    pull();
  }
  
  function channel(setHref, callback, window, rollback) {
    watchURL(window);
    xssMessageListener = function(i, n, part){
      if (i==0 && n==0 && part == "ACK") {
      } else {
        callback(decodeURIComponent(part));
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
    return send;
  };
  
  xsschannel.listen = function(callback, window){
    window = window || globalWindow;
    if (!isXssMsg(window.location.hash)) throw "Window not loaded as an iframe of xsschannel";
    var baseUrl = decodeURIComponent(window.location.hash.split(':')[3]) + "#" + PREFIX;
    function setHref(i , n , msg) {
      window.parent.location.href  = [baseUrl, i , n, encodeURIComponent(msg)].join(":");
    }
    window.location.hash = "";
    return channel(setHref, callback, window, false);
  };
  
})();
