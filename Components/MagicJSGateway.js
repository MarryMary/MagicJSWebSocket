/*
Magic JS クライアント接続処理部
 */
const fs = require('fs');
const SystemSettings = require('../../Settings/SysEnv.json');
const express = require('express');
const app = express();
const cookieParser = require('cookie-parser');
const sessionbridge = require('./MagicJSElpBridge');
const {spawn} = require("child_process");
const server = require('http').Server(app);
var room = "";
require('date-utils');
const io = require('socket.io')(server, {
    cors: {
        origin: SystemSettings.AppURL,
        methods: ["GET", "POST"],
        credentials: true
    }
});


var dt = new Date();
var nowtime = dt.toFormat("YYYY/MM/DD HH24:MI:SS");
console.log("Welcome to PHPTurbo Websocket Processor 'Cinderella Magic JS System'.");
console.log("Magic JS startup on:"+nowtime);

server.on('request', function(req, res, next) {
});

io.use((socket, next) => {
    cookieParser()(socket.request, socket.request.res, next);
});

io.use((socket, next) => {
    sessionbridge.session(socket.request, socket.request.res, next);
});

io.use((socket, next) => {
    if (socket.request.session.loggedin) {
        next();
    } else {
        next(new Error('authentication required'));
    }
});

io.on('connection', (socket) => {
    socket.on("RoomEnter", function(roomid){
        room = roomid.wsroomid;
        roomid = roomid.roomid;
        const spawn = require('child_process').spawn;
        const php  = spawn('php', ['UserRoomIsIn.php']);
        const data = {
            "userid": socket.request.session.user,
            "roomid": roomid
        };
        php.stdin.write(JSON.stringify(data));
        php.stdin.end();
        php.stdout.on('data', function(data){
            var authdata = JSON.parse(data);
            if(authdata.RoomAuthorize == "1"){
                socket.join(room);
            }
        });
    });

    socket.on('chat', function(chatdata){
        if(typeof( chatdata.chatpict ) != 'undefined') {
            chatdata.chatpict = chatdata.chatpict.toString();
        }
        const spawn = require('child_process').spawn;
        const php  = spawn('php', ['ChatInserter.php']);
        php.stdin.write(JSON.stringify(chatdata));
        php.stdin.end();
        php.stdout.on('data', function (data) {
            var Received = JSON.parse(data);
            let chatTemplate = `
  <div class="disp-flex">
    <div class="profile-img-frame">
    <img class="profile-img" src="/pict/{{pict}}">
    </div>
    <div class="posted-chat-content">
      <span><b>{{name}}</b></span>&nbsp;&nbsp;<small>{{now}}</small>
      <p class="">{{content}}</p>
    </div>
  </div>
`;
            var sendData = chatTemplate.replace('{{content}}', Received.chattext)
                .replace('{{name}}', Received.name)
                .replace('{{now}}', Received.date)
                .replace('{{pict}}', Received.pict);
            io.sockets.in(room).emit('chat_notice', sendData);
            const pushnotify  = spawn('php', ['pushsend.php']);
            pushnotify.stdin.write(JSON.stringify(chatdata));
            pushnotify.stdin.end();
        });

        php.on('exit', function (code) {
            if(code == 0){
                console.log("Process was normal termination.");
            }else if(code == 1){
                console.log("Process was abnormal termination.\n");
            }
        });
    });
});



server.listen(SystemSettings.WebSocketPort);