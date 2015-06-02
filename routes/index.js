var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

module.exports = router;

/**
 * Mongoose
 */

var mongoose = require('mongoose');

/* Schema declarations for Mongoose models */
var PostSchema = new mongoose.Schema({
  title: String,
  link: String,
  upvotes: {type: Number, default: 0},
  comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }]
});
PostSchema.methods.upvote = function(cb) {
	this.upvotes += 1;
	this.save(cb);
};

var CommentSchema = new mongoose.Schema({
  body: String,
  author: String,
  upvotes: {type: Number, default: 0},
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' }
});
CommentSchema.methods.upvote = function(cb) {
	this.upvotes += 1;
	this.save(cb);
};

/* mongoose models */
var Post = mongoose.model('Post', PostSchema);
var Comment = mongoose.model('Comment', CommentSchema);

// var Post = mongoose.model('Post');
// var Comment = mongoose.model('Comment');

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
router.post('/posts', function(req, res, next) {
  var post = new Post(req.body);

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

/* update post object */
router.put('/posts/:post/upvote', function(req, res, next) {
	req.post.upvote(function(err, post) {
		if (err) { return next(err); }

		res.json(post);
	});
});

/* create comment */
router.post('/posts/:post/comments', function(req, res, next) {
	var comment = new Comment(req.body);
	comment.post = req.post;

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
router.put('/posts/:post/comments/:comment/upvote', function(req, res, next) {
	req.comment.upvote(function(err, comment) {
		if (err) { return next(err); }

		res.json(comment);
	});
});

