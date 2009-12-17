XssChannel = TestCase("XssChannel");

XssChannel.prototype.setUp = function () {
  var self = this;
  this.historyCounter = 0;
  this.window = {
    parent: {
      location:{
        href:"http://server/parent.html"
      }
    },
    location:{
      href:"http://server/parent.html"
    },
    setTimeout:function(fn, delay){self.timeout={fn:fn, delay:delay};},
    history:{
      go:function(i){self.historyCounter += i;}
    }
  };
  this.received = [];
  this.receive = function(msg){
    self.received.push(msg);
  };
};

XssChannel.prototype.testParentShouldCreateAnIframe = function (){
  var send = xsschannel.connect("http://server/client.html", this.receive, this.window);
  assertTrue(!!send);
  assertTrue(!!send.iframe);
  assertEquals("http://server/client.html", send.url);
  assertEquals(
      "http://server/client.html#$XSS$:0:0:"+encodeURIComponent("http://server/parent.html"), 
      send.iframe.src);
  assertEquals([], this.received);
  assertTrue(!!this.timeout.fn);
};

XssChannel.prototype.testParentShouldSendMessageToClient = function(){
  var send = xsschannel.connect("http://server/client.html", this.receive, this.window);
  send("Te:st");
  assertEquals(
      "http://server/client.html#$XSS$:1:1:Te%3Ast", 
      send.iframe.src);
};

XssChannel.prototype.testParentShouldReceiveMessageToClient = function(){
  var send = xsschannel.connect("http://server/client.html", this.receive, this.window);
  this.window.location.href = "#$XSS$:1:1:Hello";
  this.timeout.fn();
  assertEquals(["Hello"], this.received);
  assertEquals(
      "http://server/client.html#$XSS$:0:0:ACK", 
      send.iframe.src);
  assertEquals(-1, this.historyCounter);
};

XssChannel.prototype.testClientShouldSendMessageToParent = function(){
  this.window.location.href = "http://server#$XSS$:0:0:"+encodeURIComponent("http://server/parent.html");
  var send = xsschannel.listen(this.receive, this.window);
  assertEquals("http://server#", this.window.location.href);
  assertEquals("http://server/parent.html", send.url);
  send("ping");
  assertEquals(
      "http://server/parent.html#$XSS$:1:1:ping", 
      this.window.parent.location.href);
  assertEquals(0, this.historyCounter);
};
