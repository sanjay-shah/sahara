var restify = require('restify');
var mongojs = require('mongojs');
var faker = require('faker');
var request = require('request');

var ObjectId = mongojs.ObjectId;


var db = mongojs('mongodb://127.0.0.1:3001/meteor', ['apis']);

var Logger = require('bunyan');
var log = new Logger({
  name: 'sahara',
  streams: [{
    stream: process.stdout,
    level: 'trace'
  }, {
    path: 'sahara.log',
    level: 'trace'
  }],
  serializers: Logger.stdSerializers,
});

var snapapilog = new Logger({
  name: 'snapapi',
  streams: [{
    stream: process.stdout,
    level: 'trace'
  }, {
    path: 'snapapi.log',
    level: 'trace'
  }],
  serializers: Logger.stdSerializers,
});

var server = restify.createServer({
  name: 'sahara',
  log: log
});

server.pre(function(req, res, next) {
  req.log.info({
    req: req
  }, 'start');
  return next();
});

server.pre(restify.pre.userAgentConnection());

server.use(restify.queryParser());

var rateLimit = restify.throttle({
  burst: 15,
  rate: 0.25,
  ip: true
});

function send(req, res, next) {
  //res.send('req.params.name: ' + req.params.name);
  console.log('hello....');


  return next();
}

server.get({
    name: 'your-api',
    path: '/your-api'
  },
  rateLimit,
  function list(req, res, next) {
    req.log.info('inside get handler'); 
    skip = +req.params.from || +0;
    limit = +req.params.to || +50;
    limit = limit > 50 ? +50 : limit;
    db.apis.find({}, {
      limit: limit,
      skip: skip,
      field: "body"
    }, function(err, data) {
      if (data.length == 0) {
        res.send(404);
      } else {

        res.writeHead(200, {
          "Content-type": "application/json; charset=utf-8"
        });
        response = {};
        response.body = data;
        if ((skip - limit) < 0) {
          from = +0;
        } else {
          from = skip - limit;
        }

        if (skip != 0) {
          response.previousDataBlock = server.router.render('your-api', {}, {
            from: from,
            to: skip
          });
        }
        if (data.length == limit) {
          response.nextDataBlock = server.router.render('your-api', {}, {
            from: skip + limit,
            to: skip + limit + limit
          });
          //response.nextDataBlock = "/your-1234";
        }
        res.end(JSON.stringify(response));
      }
    });
    return next();
  });

server.get('/your-api/:id',
  rateLimit,
  function id(req, res, next) {
    ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    //console.log("client ip: " + ip);
    //console.log("called path /your-api/" + req.params.id);

    randomNumber = faker.random.number(99999);
    if (req.params.id == 'sample') {
      sample = {};
      sample.status = 200;
      sample.body = faker.Helpers.userCard();
      sample.headers = {
        "Content-type": "application/json; charset=utf-8",
        "randomHeader": randomNumber
      };
      res.writeHead(sample.status, sample.headers);
      res.end(JSON.stringify(sample.body));
      //console.log(JSON.stringify(sample));
      db.apis.save(sample);
    } else {
      db.apis.findOne({
        _id: ObjectId(req.params.id)
      }, function(err, data) {
        res.writeHead(data.status, data.headers);
        res.end(JSON.stringify(data.body));
      });
    }
    return next();
  });

server.head('/your-api/:name', send);
server.del('your-api/:id', function remove(req, res, next) {
  db.apis.remove({
    _id: ObjectId(req.params.id)
  }, function(err, data) {
    res.send(204);
  });
  return next();
});

server.get('/snap/api/:snapurl',
  rateLimit,
  function id(req, res, next) {
    
    snapurl = req.params.snapurl;
    req.log.debug('snapurl is "%s"', snapurl);   
    
    ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    
    request(snapurl, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        console.log(body) // Print the google web page.
      }
    });
    /*
    var client = restify.createJsonClient({
      url: 'http://localhost:8080/',
      version: '*',
      log: snapapilog
    });
    req.log.debug('client is "%s"', JSON.stringify(client)); 
    console.log("here->>");
    //client.basicAuth('$login', '$password');
    client.get(url, function(err, outboundreq, outboundres, obj) {
    //assert.ifError(err);
    console.log(JSON.stringify(obj, null, 2));
    res.send(200, obj);
  });*/
    return next();
  });
  
server.on('after', function (req, res, route) {
  //req.log.info({res: res}, "finished");             // (3)
});

server.listen(8080, function() {
  console.log('%s listening at %s', server.name, server.url);
});
