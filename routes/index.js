var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Flappa' });
});

module.exports = router;

/**
 * Mongoose Schema declarations
 */

var mongoose = require('mongoose');

/* Post Schema */
var PostSchema = new mongoose.Schema({
  title: String,
  link: String,
  author: String,
  upvotes: {type: Number, default: 1},
  comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }]
});

PostSchema.methods.upvote = function(cb) {
	this.upvotes += 1;
	this.save(cb);
};

PostSchema.methods.downvote = function(cb) {
	this.upvotes -= 1;
	this.save(cb);
};


/* Comment Schema */
var CommentSchema = new mongoose.Schema({
  body: String,
  author: String,
  upvotes: {type: Number, default: 1},
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' }
});

CommentSchema.methods.upvote = function(cb) {
	this.upvotes += 1;
	this.save(cb);
};

CommentSchema.methods.downvote = function(cb) {
	this.upvotes -= 1;
	this.save(cb);
};

/* User Schema */
var UserSchema = new mongoose.Schema({
	username: { type: String, lowercase: true, unique: true },
	hash: String,
	salt: String
});

var crypto = require('crypto');
var jwtoken = require('jsonwebtoken');

UserSchema.methods.setPassword = function(password) {
	this.salt = crypto.randomBytes(16).toString('hex');
	this.hash = crypto.pbkdf2Sync(password, this.salt, 1000, 64).toString('hex');
};

UserSchema.methods.validPassword = function(password) {
	var hash = crypto.pbkdf2Sync(password, this.salt, 1000, 64).toString('hex');
	return this.hash === hash;
};

UserSchema.methods.generateJWT = function() {
	// set expiration to 60 days
	var today = new Date();
	var exp = new Date(today);
	exp.setDate(today.getDate() + 60);

	return jwtoken.sign({
		_id: this._id,
		username: this.username,
		exp: parseInt(exp.getTime() / 1000)
	}, 'SECRET');
};


/* Instantiate mongoose models */
var Post = mongoose.model('Post', PostSchema);
var Comment = mongoose.model('Comment', CommentSchema);
var User = mongoose.model('User', UserSchema);

var passport = require('passport');
var jwt = require('express-jwt');
var auth = jwt({secret: 'SECRET', userProperty: 'payload'});

router.post('/register', function(req, res, next) {
	if (!req.body.username || !req.body.password) {
		return res.status(400).json({message: 'Please fill out all fields'});
	}
	var user = new User();
	user.username = req.body.username;
	user.setPassword(req.body.password);

	user.save(function(err) {
		if (err) { return next(err); }

		return res.json({token: user.generateJWT()});
	});
});

router.post('/login', function(req, res, next) {
	if (!req.body.username || !req.body.password) {
		return res.status(400).json({message: 'Please fill out all fields'});
	}

	passport.authenticate('local', function(err, user, info) {
		if (err) { return next(err); }

		if (user) {
			return res.json({token: user.generateJWT()});
		} else {
			return res.status(401).json(info);
		}
	})(req, res, next);
});


/**
 * Setting up routing
 */

/* GET all posts */
router.get('/posts', function(req, res, next) {
  Post.find(function(err, posts){
    if(err){ return next(err); }

    res.json(posts);
  });
});

/* create a new post */
router.post('/posts', auth, function(req, res, next) {
  var post = new Post(req.body);
  post.author = req.payload.username;

  post.save(function(err, post){
    if(err){ return next(err); }

    res.json(post);
  });
});

/* middleware function: preloading a post object (by ID) */
router.param('post', function(req, res, next, id) {
	var query = Post.findById(id);

	query.exec(function(err, post) {
		if (err) { return next(err); }
		if (!post) { return next(new Error('can\'t find post')); }

		req.post = post;
		return next();
	});
});

/* get a single post object (by ID) and all comments */
router.get('/posts/:post', function(req, res, next) {
	req.post.populate('comments', function(err, post) {
		if (err) { return next(err); }

		res.json(post);
	});
});

/* update post object with upvote */
router.put('/posts/:post/upvote', auth, function(req, res, next) {
	req.post.upvote(function(err, post) {
		if (err) { return next(err); }

		res.json(post);
	});
});

/* update post object with downvote */
router.put('/posts/:post/downvote', auth, function(req, res, next) {
	req.post.downvote(function(err, post) {
		if (err) { return next(err); }

		res.json(post);
	});
});

/* create comment */
router.post('/posts/:post/comments', auth, function(req, res, next) {
	var comment = new Comment(req.body);
	comment.post = req.post;
	comment.author = req.payload.username;

	comment.save(function(err, comment) {
		if (err) { return next(err); }

		req.post.comments.push(comment);
		req.post.save(function(err, post) {
			if (err) { return next(err); }

			res.json(comment);
		});
	});
});

/* middleware function: retrieve comments by ID */
router.param('comment', function(req, res, next, id) {
	var query = Comment.findById(id);

	query.exec(function(err, comment) {
		if (err) { return next(err); }
		if (!comment) { return next(new Error('can\'t find comment')); }

		req.comment = comment;
		return next();
	});
});

/* update comment object with upvote */
router.put('/posts/:post/comments/:comment/upvote', auth, function(req, res, next) {
	req.comment.upvote(function(err, comment) {
		if (err) { return next(err); }

		res.json(comment);
	});
});

/* update comment object with downvote */
router.put('/posts/:post/comments/:comment/downvote', auth, function(req, res, next) {
	req.comment.downvote(function(err, comment) {
		if (err) { return next(err); }

		res.json(comment);
	});
});