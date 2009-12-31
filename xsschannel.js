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
 * 
 * Message format:
 *   id:seq:i:n:msg
 *   
 *   id -> unique identifier which will allow the source to identify
 *         destination of the message
 *   seq-> monotonicaly increasing sequence number
 *   i  -> message fragment number
 *   n  -> number of message fragments
 *   msg-> Payload message
 *   
 * Protocol:
 *   each request needs to be acknowledged before next request 
 *   can be sent.
 * 
 */

(function(){
  xsschannel = {
    log: false
  };
  var globalWindow = window;
  var PREFIX = "$XSS$";
  var delay = 20;
  var maxMsgSize = 1800;
  var channels = {};
  function log(a, b) {
    if (typeof console == "object" && xsschannel.log)
      console.log(a, b);
  }
  function parseHref(href) {
    var match = href.match(/^(.*)#\$XSS\$:(.*):(.*):(.*):(.*):(.*)$/);
    return match ? {
      url:match[1], 
      id: match[2],
      seq: match[3],
      i:match[4], 
      n:match[5], 
      msg:match[6],
      isAck: match[4]==0 && match[5]==0 && match[6] == "ACK"} : false;
  }
  
  function watchURL(window){
    var location = window.location;
    var last = location.href;
    function pull(){
      var href = location.href;
      if (last != href) {
        var hash = parseHref(href);
        log("CHANGE", href, hash);
        if (hash) {
          channels[hash.id](hash);
          if (last.indexOf('#') < 0) {
            last += "#";
          }
          location.href = last;
        }
        last = location.href;
      }
      window.setTimeout(pull, delay);
    };
    pull();
  }
  
  function channelHash(id, callback, window, setHref) {
    watchURL(window);
    var ACK = {};
    var queue = [];
    var flushEnabled = true;
    function dequeue(msg) {
      var msg = queue.shift();
      log("dequeue:", msg);
      flushEnabled = true;
    }
    function enqueue(msg) {
      if (msg === ACK) {
        if (queue.length > 0) return;
        queue.push(ACK);
      } else {
        log("enqueue:", msg);
        msg = encodeURIComponent(msg);
        var i = 0;
        var n = Math.ceil(msg.length / maxMsgSize);
        for ( var i = 0; i < n; i++) {
          queue.push({i:i, n:n-1, msg:msg.substr(i * maxMsgSize, maxMsgSize)});
        }
      }
    }
    function flush(msg) {
      if (flushEnabled && queue.length > 0) {
        var msg = queue[0];
        if (msg === ACK) {
          setHref(0, 0, "ACK");
          queue.shift();
        } else {
          flushEnabled = false;
          setHref(msg.i, msg.n, msg.msg);
        }
        log("sending:", msg);
      }
    }
    function send (msg){
      enqueue(msg);
      flush();
    };
    send.id = id;
    send.expectedSeq = 0;
    send.queue = queue;
    send.pending = false;
    var part = "";
    channels[id] = function(hash){
      log(hash, send.expectedSeq);
      if (hash.seq == send.expectedSeq) {
        send.expectedSeq ++;
        dequeue();
        if (!hash.isAck) {
          part += hash.msg;
          if (hash.i == hash.n) {
            callback(decodeURIComponent(part));
            part = "";
          }
          enqueue(ACK);
        }
        flush();
      } else {
        log("BROKEN SEQ expected:" + send.expectedSeq + " was " + hash.seq);
      }
    };
    return send;
  }
  
  function channelPostMessage(id, callback, window, dstContainer) {
    window.addEventListener("message", function(event){
      var msg = event.data;
      var index = msg.indexOf(":");
      if (index > 0 && id == msg.substring(0, index)) {
        callback(msg.substring(index + 1));
      }
    }, false);
    return function(msg){
      dstContainer.contentWindow.postMessage(id + ":" + msg, "*");
    };
  }
  
  function channel(id, callback, window, dstContainer, setHref) {
    if (typeof window.postMessage == 'function') {
      return channelPostMessage(id, callback, window, dstContainer);
    } else {
      return channelHash(id, callback, window, setHref);
    }
  }
  
  xsschannel.connect = function (url, callback, window) {
    window = window || globalWindow;

    var id = (""+window.Math.random()).substring(2);
    var name = id + ":" + encodeURIComponent(window.location.href.split('#')[0]);
    var div = document.createElement('div') ;
    div.innerHTML = '<iframe name="' + name + '" src="'+url+'#" style="display:none;">';
    var iframe = div.childNodes[0];
    
    var send = channel(id, callback, window, iframe, function(i , n , msg) {
      send.iframe.src  = [send.url + "#" + PREFIX, send.id, (send.seq++), i , n, msg].join(":");
    });
    send.seq = 0;
    send.url = url;
    send.iframe = iframe;
    return send;
  };
  
  xsschannel.listen = function(callback, window){
    window = window || globalWindow;
    var id = window.name.split(":")[0];
    var send = channel(id, callback, window, {contentWindow:window.parent}, function (i, n, msg) {
      window.parent.location.href =
        [send.url + "#" + PREFIX, send.id, (send.seq++), i , n, msg].join(":");
    });
    send.seq = 0;
    send.url = decodeURIComponent(window.name.split(":")[1]);
    return send;
  };
})();
