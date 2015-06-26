//  Connect websocket to exchange webRTC SDPs
function ws(uri) {
  return new Promise(function (resolve) {
    ws = new WebSocket(uri);
    ws.onopen = resolve;
    ws.onmessage = function(m) {
      var desc = JSON.parse(m.data);
      if (desc.type === "register") desc.ids.forEach(function (id) {
        $("#peers").appendChild($("#peer > *").cloneNode(true)).setAttribute("class", "peer-" + id);
        $("#peers > .peer-" + id + " .handle").innerHTML = id;
        $("#peers > .peer-" + id + " .handle").addEventListener("keydown", function (e) {
          if (e.which === 13) { e.preventDefault(); this.blur() }
        })
        $("#peers > .peer-" + id + " .actions").addEventListener("click", function (e) {
          if (e.target.classList.contains("plus")) rtc(id);
          else if (e.target.classList.contains("minus")) peers[id].connection.close()
        });
        $("#peers > .peer-" + id + " .state").addEventListener("click", function (e) {
          if (!e.target.classList.contains("chat")) swapWindow(id)
        })
        if (id === selfid) return $("#peers > .peer-" + id).classList.add("self");
        peers[id] = {};
        $("#peers > .peer-" + id + " .actions").classList.add("plus");
        $("#display").appendChild($("#peer-window > *").cloneNode(true)).setAttribute("class", "peer-" + id);
        input(id).addEventListener("keyup", function (e) {
          if (e.which === 13) {
            write(id, this.value, "local");
            peers[id].dataChannel.send('{"id":"' + selfid + '","msg":"' + this.value.replace(/"/, '\\"') + '"}');
            this.value = ""
          }
        })
      });
      if (desc.type === "deregister") {
        if (m = $("#peers > .peer-" + desc.ids[0] + ":not(.open)")) $("#peers").removeChild(m);
      }
      if (desc.type === "offer") rtc(desc.id, desc);
      else if (desc.type === "answer") peers[desc.id].connection.setRemoteDescription(new RTCSessionDescription(desc))
    }
  })
}
//  Offer/answer webRTC with video + audio stream & chat on a data channel
function rtc (id, odesc) {
  peers[id].connection = new RTCPeerConnection({"iceServers": [{ "url": "stun:stun.l.google.com:19302" }]}, { optional: [{ "RtpDataChannels": false }] });
//  navigator.getUserMedia({}, function(stream) {
//    localMediaStream = stream;
//    pc.addStream(localMediaStream);
      peers[id].connection.onicecandidate = function (e) {
        if (e.candidate === null) ws.send( JSON.stringify(merge(this.localDescription.toJSON(), { id: id })) )
      };
      peers[id].connection.oniceconnectionstatechange = function (e) { if (e.target.iceConnectionState === "closed") closeConn(id) }
//    pc.onaddstream = function (e) { remotevideo.src = window.URL.createObjectURL(e.stream) };
    if (odesc) {
      peers[id].connection.ondatachannel = function (e) { peers[id].dataChannel = e.channel || e; start(id) };
      peers[id].connection.setRemoteDescription(new RTCSessionDescription(odesc), function () {
        peers[id].connection.createAnswer( function (adesc) { peers[id].connection.setLocalDescription(adesc) }, nilfun )
      }, nilfun)
    } else {
      peers[id].dataChannel = peers[id].connection.createDataChannel('social', {reliable: true})
      start(id);
      peers[id].connection.createOffer(function (desc) { peers[id].connection.setLocalDescription(desc, nilfun, nilfun) }, nilfun)
    }
//  }, nilfun);
  function start(id) {
    peers[id].dataChannel.onopen = function () {
      $("#peers > .peer-" + id).classList.add("open");
      $("#peers > .peer-" + id + " .actions").classList.remove("plus");
      $("#peers > .peer-" + id + " .actions").classList.add("minus");
      if ($("#display > .focus")) return swapWindow(id);
      $("#peers > .peer-" + id + " .state").classList.add("chat");
      $("#display > .peer-" + id).classList.add("focus")
    };
    peers[id].dataChannel.onmessage = function (e) {
      var data = JSON.parse(e.data);
      write(data.id, data.msg, "remote")
      if ($("#peers > .peer-" + id + ".open")) {
        $("#peers > .peer-" + id + " .state").classList.remove("no-new-msg");
        $("#peers > .peer-" + id + " .state").classList.add("new-msg");
      }
    }
  }
}
//  HTML escape utility
function escape (text) {
  var div = document.createElement("div");
  div.appendChild(document.createTextNode(text));
  return div.innerHTML
}
//  Reset main height to window height
function resize () { $("main").style.height = window.innerHeight + "px" }
//  Display chat message
function write (id, msg, source) {
  var a = document.createElement("p");
  a.className = source + "msg";
  a.innerHTML = escape(msg.replace(/\\"/, '"'));
  display(id).appendChild(a);
  display(id).scrollTop = display(id).scrollHeight
}
function display (id) { return $("#display > .peer-" + id + " > .display") }
function input (id) { return $("#display > .peer-" + id + " > .input") }
function merge (obj1, obj2) {
  for (var a in obj2) obj1[a] = obj2[a]
  return obj1
}
function $ (q) { return document.querySelector(q) }
function closeConn (id) {
  $("#peers > .peer-" + id + " .actions").classList.remove("minus");
  $("#peers > .peer-" + id + " .actions").classList.add("plus");
  $("#peers > .peer-" + id).classList.remove("open");
  $("#peers > .peer-" + id + " .state").classList.remove("chat");
  $("#display > .peer-" + id).classList.remove("focus")
}
function swapWindow (id) {
  $("#peers .state.chat").classList.add("no-new-msg");
  $("#peers .state.chat").classList.remove("chat");
  $("#display > .focus").classList.remove("focus");
  $("#peers > .peer-" + id + " .state").classList.add("chat");
  $("#display > .peer-" + id).classList.add("focus")
}

//Variables
var
  nilfun = function () {}, localMediaStream, ws, peers = {},
  selfid = localStorage.peerID = localStorage.peerID || crypto.getRandomValues(new Uint32Array(1))[0].toString(16);

//Browser prefix reset
RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
RTCSessionDescription = window.RTCSessionDescription || window.webkitRTCSessionDescription || window.mozRTCSessionDescription;
navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

//Event listeners
window.addEventListener("beforeunload", function () { ws.close() });
window.addEventListener("resize", function() {
  return new Promise(function (resolve) {
    requestAnimationFrame(function () { resolve(); window.dispatchEvent(new CustomEvent("opresize")) })
  })
});
window.addEventListener("opresize", resize);

//Init
resize();
ws("wss://den-chan.herokuapp.com/pool").then(function () { ws.send(JSON.stringify({type: "register", id: selfid})) })