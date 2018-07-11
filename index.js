const http = require('http');
const fs = require('fs');

const path = require('path');

const hostname = "localhost";
const port = 3000;

const httpServerMain = http.createServer((req,res) => {
    //console.log(req.headers);

    if(req.url == '/'){
        var indexHtml = path.resolve('./public'+'/index.html');
        res.statusCose = 200;
        res.setHeader('Content-Type', 'text/html');
        fs.createReadStream(indexHtml).pipe(res);
    }
    else{
        var fileUrl = req.url;
        var filePath = path.resolve('./public'+fileUrl);    
        var filePathArray = filePath.split('/');
        var file = filePathArray[filePathArray.length-1];
        if(path.extname(file) == '.js'){    
            var JSfile = path.resolve('./public/'+ file);
            res.statusCose = 200;
            res.setHeader('Content-Type', 'text/javascript');
            fs.createReadStream(JSfile).pipe(res);
        }
    }
});

httpServerMain.listen(port, hostname, () => {
    console.log(`server running at http://${hostname}:${port}`);
});


////////////////////////////////////////////////////////////////

var persistence = require('aedes-persistence-redis')({
  port: 6379,
  host: '127.0.0.1',
  family: 4, // ipv4 or ipv6
  db: 0,
  maxSessionDelivery: 100, // maximum offline messages deliverable on client CONNECT, default is 1000
  packetTTL: function (packet) { // offline message TTL, default is disabled
   return 3600 //seconds
  }
})

var aedes = require('aedes')({
  mq: require('mqemitter-redis')(),
  persistence: persistence
})

var amqp = require('amqplib/callback_api');
var server = require('net').createServer(aedes.handle);
var ws = require('websocket-stream');
var portAedes = 1883;

server.listen(portAedes, function () {
  console.log('aedes server listening on port', portAedes);
});

var ports = [8000, 8001, 8002, 8003];
var servers = [];
ports.forEach(function(port) {
    var httpServer = require('http').createServer();
    ws.createServer({server: httpServer}, aedes.handle);// must for 'ws' stream
    httpServer.listen(port, function () {
      console.log('websocket server listening on port', port);
    });
    servers.push(httpServer);
});

aedes.on('clientError', function (client, err) {
  console.log('client error', client.id, err.message, err.stack);
});

aedes.on('connectionError', function (client, err) {
  console.log('client error', client, err.message, err.stack);
});

aedes.on('publish', function (packet, client) {
  if (client) {
    //console.log('message from client', client.id);
    //console.log(packet);
  }
});

aedes.on('subscribe', function (subscriptions, client) {
  if (client) {
    //console.log('subscribe from client', subscriptions, client.id);
  }
});

aedes.on('client', function (client) {
  console.log('new client', client.id);
});

aedes.on('clientDisconnect', function (client) {
  console.log('client Disconnected', client.id);
});

setInterval(function(){
  console.log('connected Clients: ', aedes.connectedClients);
}, 2000);

function handlePublish(payload , msg, ch){
    var restId = JSON.parse(payload).restId;
    var topic = 'rest/' + restId.toString();
    var order = {
      topic: topic,
      payload: new Buffer.from(payload),
      qos: 2,
    };
    if(aedes && ch){
      aedes.publish(order);
      ch.ack(msg);
    }
}

//for recieving messages from rabbitMq server
setTimeout(function(){
  amqp.connect('amqp://localhost', function(err, conn) {
      if(err){
        console.log(err);
      }else{
        conn.createChannel(function(err, ch) {
          if(err){
            console.log(err);
          }else{
            var q = 'restaurantOrders';
            ch.assertQueue(q, {durable: true});
            // Note: on Node 6 Buffer.from(msg) should be used
            ch.consume(q, function(msg) {
              var payload = msg;
              payload = JSON.stringify(payload.content);
              payload = Buffer.from(JSON.parse(payload).data);
              payload = payload.toString('utf8');
              handlePublish(payload, msg, ch);
            }, {noAck: false});
          }
        });
      } 
  });
}, 1000);
