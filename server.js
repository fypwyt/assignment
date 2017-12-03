var session = require('cookie-session');
var express = require('express');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var assert = require('assert');
var app = express();
var fileUpload = require('express-fileupload');
var MongoClient = require('mongodb').MongoClient;

var mongodburl = 'mongodb://wyt:wyt@ds125906.mlab.com:25906/test1';
var ObjectId = require('mongodb').ObjectID;
mongoose.connect(mongodburl);


var rSchema = require('./restaurant');
var restaurant = mongoose.model('restaurant', rSchema);


var uSchema = require('./user');
var user = mongoose.model('user', uSchema);


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({	extended: true}));
app.use(fileUpload());

app.set('view engine', 'ejs');

app.use(session({
  name: 'session',
  keys: ['session_key1','session_key2']
}));

app.get('/',function(req,res) {
	console.log(req.session);
	if (!req.session.authenticated) {
		res.redirect('/login');
	}
	res.redirect('/list');
});

app.get("/login", function (req,res) {
	res.sendFile( __dirname + '/views/login.html')

})

app.post("/login", function (req,res) {
	user.findOne(
		{
			user_name : req.body.user_name,
			password : req.body.password
		},
		function (err, docs) {
			if (err) {
				res.status(500).json(err);
				throw err
			}else {
				req.session.authenticated = true;
				req.session.username = docs.username;
				res.redirect('/list')
			}
		}
	);
})

app.get('/logout',function(req,res) {
	req.session = null;
	res.redirect('/');
});






app.get("/newuser", function (req,res) {
	res.sendFile( __dirname + '/views/newUser.html')
})

app.post("/newuser", function(req, res){
	var newO = {};

	newO.username = req.body.name;
	newO.password = req.body.password;

	var s = new user(newO);
	//s.save(function(err) {
	//	if (err) {
	//		res.status(500).json(err);
	//		throw err
	//	}
	//	res.redirect('/');
	//});
	console.log('About to insert: ' + JSON.stringify(s));
	MongoClient.connect(mongodburl,function(err,db) {
		assert.equal(err,null);
		console.log('Connected to MongoDB\n');
		insertUser(db,s,function(result) {
			db.close();
			console.log(JSON.stringify(result.ops[0]));
			res.end(JSON.stringify({status:'ok','_id':result.ops[0]._id}));
			res.redirect('/');
			if(result.ops[0]==null){
				res.end(""+{status:'failed'});
			}		
		});
	});



})

function insertUser(db,r,callback) {
	db.collection('users').insertOne(r,function(err,result) {
		assert.equal(err,null);
		console.log("Insert success");
		callback(result);
	});
}


app.get("/list", function(req, res){
	var display = {};
	display[req.query.criteria] = req.query.keyword;
	if(req.query.criteria == undefined){
		req.query.criteria = 'name';
	}
	var criteria = {};
	criteria[req.query.criteria] = new RegExp(req.query.keyword, 'i');
	find_restaurant(criteria, function(doc){
		res.render("list",{"user_name" : req.session.username,"criteria" : JSON.stringify(display),"restaurants" : doc, });
	});
})

app.get("/api/read/name/:name", function(req, res) {
	find_restaurant({"name" : req.params.name}, function(doc){
		res.jsonp(doc);
	});
})

app.get("/api/read/borough/:borough", function(req, res) {
	find_restaurant({"borough" : req.params.borough}, function(doc){
		res.jsonp(doc);
	});
})

app.get("/api/read/cuisine/:cuisine", function(req, res) {
	find_restaurant({"cuisine" : req.params.cuisine}, function(doc){
		res.jsonp(doc);
	});
})

function find_restaurant(criteria, callback){
	restaurant.find(criteria,function (err, doc) {
		if (err) {
			res.status(500).json(err);
			throw err
		}else {
			callback(doc);
		}
	});
}

app.get("/insert", function (req,res) {
	res.sendFile( __dirname + '/views/newRestaurant.html')
})

app.post("/insert", function(req, res){
	var nrO = {};
	nrO.name = req.body.name;
	nrO.borough = req.body.borough;
	nrO.cuisine = req.body.cuisine;
	nrO.address = {};
	nrO.address.street = req.body.street;
	nrO.address.building = req.body.building;
	nrO.address.zipcode = req.body.zipcode;
	nrO.address.coord = [];
	nrO.address.coord.push(req.body.lon);
	nrO.address.coord.push(req.body.lat);
	nrO.createBy = req.session.username;

	if(req.files.sampleFile){
	    nrO.photo = new Buffer(req.files.sampleFile.data).toString('base64');
	    nrO.minetype = req.files.sampleFile.mimetype;
	}else {
		nrO.minetype=null;
	}

	var r = new restaurant(nrO);
	/*r.save(function(err) {
		if (err) {
			res.status(500).json(err);
			throw err
		}
		res.redirect('/list');
	});*/
	console.log('About to insert: ' + JSON.stringify(r));
	MongoClient.connect(mongodburl,function(err,db) {
		assert.equal(err,null);
		console.log('Connected to MongoDB\n');
		insertRestaurant(db,r,function(result) {
			db.close();
			console.log(JSON.stringify(result.ops[0]));
			res.redirect('/list');
			res.end(JSON.stringify({status:'ok','_id':result.ops[0]._id}));
			if(result.ops[0]==null){
				res.end(""+{status:'failed'});
			}		
		});
	});
})

app.post("/api/create", function(req, res){
	var body = "";
	console.log(req.body.address);

	var r = new restaurant(req.body);
	r.save(function(err, doc) {
		if(err){
			res.end(JSON.stringify({"status" : "failed"}));
		}else
			res.end(JSON.stringify({"status" : "ok", "_id" : doc._id.toString() }));
	});
})

function insertRestaurant(db,r,callback) {
	db.collection('restaurants').insertOne(r,function(err,result) {
		assert.equal(err,null);
		console.log("Insert success!");
		callback(result);
	});
}


app.get("/details", function(req,res){
	restaurant.findOne({_id : ObjectId(req.query._id)},function (err, doc) {
		if (err) {
			res.status(500).json(err);
			throw err
		}else {
			res.render("details",{"user_name" : req.session.username, "restaurant" : doc});
		}
	});
})


app.get("/edit", function(req,res){
	restaurant.findOne({_id : ObjectId(req.query._id)},function (err, doc) {
		if (err) {
			res.status(500).json(err);
			throw err
		}else {
			res.render("edit",{"user_name" : req.session.username, "restaurant" : doc});
		}
});
})
app.post("/edit", function(req,res){

	if(req.session.username == ""){
		res.redirect("/login");
	}
	restaurant.findById(req.body.id, function(err, restaurant){
		if(err){
			res.status(500).send(err);
		}else{
			var coord = [req.body.lon, req.body.lat];

			restaurant.name = req.body.name;
			restaurant.borough = req.body.borough;
			restaurant.cuisine = req.body.cuisine;
			restaurant.address.street = req.body.street;
			restaurant.address.building = req.body.building;
			restaurant.address.zipcode = req.body.zipcode;
			restaurant.address.coord = coord;
			//restaurant.photo = new Buffer(req.files.sampleFile.data).toString('base64');
			//restaurant.minetype = req.files.sampleFile.mimetype;
			if(req.files.sampleFile){
				restaurant.photo  = new Buffer(req.files.sampleFile.data).toString('base64');
				restaurant.minetype = req.files.sampleFile.mimetype;
			}else {
				restaurant.minetype = null;
			}
			restaurant.save(function (err,doc) {
				if(err){
					res.status(500).send(err);
				}
				res.redirect("/details?_id=" + restaurant._id.toString());
			})
		}
	});
})

app.get("/delete", function(req,res){
	restaurant.remove({_id : ObjectId(req.query._id)}, function(err){
		if(err){
			res.status(500).json(err);
			throw err;
		}else{
			res.redirect('/list');
		}
	});
})



app.get("/rate", function(req,res){
	res.render("rate",{"id" : req.query._id});
})
app.post("/rate", function(req,res){

	if(req.session.username == ""){
		res.redirect("/login");
	}
	restaurant.findById(req.body.id, function(err, restaurant){
		if(err){
			res.status(500).send(err);
		}else{
			var repeat = false;
			for(var i = 0; i<restaurant.rating.length; i++){

				if(req.session.username == restaurant.rating[i].rateBy){
					repeat = true;
					break;
				}
			}
			if(!repeat){
				restaurant.rating.push({"rate":req.body.rating, "rateBy" : req.session.username});
				restaurant.save(function (err,doc) {
					if(err){
						res.status(500).send(err);
					}
					res.redirect("/details?_id=" + restaurant._id.toString());
				})
			}else{
				res.end("<p>You rated this restaurant before</p><br><p><a href='/list'>home page</a>");
			}
		}
	});
})



app.get("/map", function(req,res) {
	var lat  = req.query.lat;
	var lon  = req.query.lon;
	var zoom = req.query.zoom;

	res.render("map.ejs",{'lat' : lat, 'lon' : lon, 'zoom' : zoom, 'name' : req.query.name});
	res.end();
});


app.listen(process.env.PORT || 8099);
