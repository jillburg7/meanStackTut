var app = angular.module('flapperNews', ['ui.router']);

/* route config */
app.config(['$stateProvider', '$urlRouterProvider', function($stateProvider, $urlRouterProvider) {

	$stateProvider
		.state('home', {
			url: '/home',
			templateUrl: '/home.html',
			controller: 'MainCtrl',
			resolve: {
				postPromise: ['posts', function(posts) {
					return posts.getAll();
				}]
			}
		})
		.state('posts', {
			url: '/posts/{id}',
			templateUrl: '/posts.html',
			controller: 'PostsCtrl',
			resolve: {
				post: ['$stateParams', 'posts', function($stateParams, posts) {
					return posts.get($stateParams.id);
				}]
			}
		})
		.state('login', {
			url: '/login',
			templateUrl: '/login.html',
			controller: 'AuthCtrl',
			onEnter: ['$state', 'auth', function($state, auth) {
				if (auth.isLoggedIn()) {
					$state.go('home');
				}
			}]
		})
		.state('register', {
			url: '/register',
			templateUrl: '/register.html',
			controller: 'AuthCtrl',
			onEnter: ['$state', 'auth', function($state, auth) {
				if (auth.isLoggedIn()) {
					$state.go('home');
				}
			}]
		});

	$urlRouterProvider.otherwise('home');
}]);

/* authentication service */
app.factory('auth', ['$http', '$window', function($http, $window) {
	var auth = {};

	auth.saveToken = function(token) {
		$window.localStorage['flapper-news-token'] = token;
	};

	auth.getToken = function() {
		return $window.localStorage['flapper-news-token'];
	};

	auth.isLoggedIn = function() {
		var token = auth.getToken();

		if (token) {
			var payload = JSON.parse($window.atob(token.split('.')[1]));

			return payload.exp > Date.now() / 1000;
		} else {
			return false;
		}
	};

	auth.currentUser = function() {
		if (auth.isLoggedIn()) {
			var token = auth.getToken();
			var payload = JSON.parse($window.atob(token.split('.')[1]));

			return payload.username;
		}
	};

	auth.register = function(user) {
		return $http.post('/register', user).success(function(data) {
			auth.saveToken(data.token);
		});
	};

	auth.logIn = function(user) {
		return $http.post('/login', user).success(function(data) {
			auth.saveToken(data.token);
		});
	};

	auth.logOut = function() {
		$window.localStorage.removeItem('flapper-news-token');
	};

	return auth;
}]);

/* authentication controller */
app.controller('AuthCtrl', ['$scope', '$state', 'auth', function($scope, $state, auth) {
	$scope.user = {};

	$scope.register = function() {
		auth.register($scope.user).error(function(error) {
			$scope.error = error;
		}).then(function() {
			$state.go('home');
		});
	};

	$scope.logIn = function() {
		auth.logIn($scope.user).error(function(error) {
			$scope.error = error;
		}).then(function() {
			$state.go('home');
		});
	};
}]);

/* navbar controller */
app.controller('NavCtrl', ['$scope', 'auth', function($scope, auth) {
	$scope.isLoggedIn = auth.isLoggedIn;
	$scope.currentUser = auth.currentUser;
	$scope.logOut = auth.logOut;
}]);

/* posts service */
app.factory('posts', ['$http', 'auth', function($http, auth) {
	var o = {
		posts: []
	};

	o.get = function(id) {
		return $http.get('/posts/' + id).then(function(res) {
			return res.data;
		});
	};

	o.getAll = function() {
		return $http.get('/posts').success(function(data) {
			angular.copy(data, o.posts);
		});
	};

	o.create = function(post) {
		return $http.post('/posts', post, {
			headers: { Authorization: 'Bearer ' + auth.getToken() }
		}).success(function(data) {
			o.posts.push(data);
		});
	};

	o.remove = function(post, index) {
		return $http.delete('/posts/' + post._id).success(function(data) {
			console.log(index);
			console.log(o.posts[index]);
			o.posts.splice(index, 1);
		});
	};

	o.upvote = function(post) {
		return $http.put('/posts/' + post._id + '/upvote', null, {
			headers: { Authorization: 'Bearer ' + auth.getToken() }
		}).success(function(data) {
			post.upvotes += 1;
		});
	};

	o.downvote = function(post) {
		return $http.put('/posts/' + post._id + '/downvote', null, {
			headers: { Authorization: 'Bearer ' + auth.getToken() }
		}).success(function(data) {
			post.upvotes -= 1;
		});
	};

	o.addComment = function(id, comment) {
		return $http.post('/posts/' + id + '/comments', comment, {
			headers: { Authorization: 'Bearer ' + auth.getToken() }
		});
	};

	o.upvoteComment = function(post, comment) {
		return $http.put('/posts/' + post._id + '/comments/' + comment._id + '/upvote', null, {
			headers: { Authorization: 'Bearer ' + auth.getToken() }
		}).success(function(data) {
			comment.upvotes += 1;
		});
	};

	o.downvoteComment = function(post, comment) {
		return $http.put('/posts/' + post._id + '/comments/' + comment._id + '/downvote', null, {
			headers: { Authorization: 'Bearer ' + auth.getToken() }
		}).success(function(data) {
			comment.upvotes -= 1;
		});
	};

	return o;
}]);

/* home page controller */
app.controller('MainCtrl', ['$scope', 'posts', 'auth', function($scope, posts, auth) {
	$scope.posts = posts.posts;
	$scope.isLoggedIn = auth.isLoggedIn;
	$scope.currentUser = auth.currentUser;

	$scope.addPost = function() {
		if ($scope.title) {
			posts.create({
				title: $scope.title,
				link: $scope.link,
				author: $scope.author
			});
			$scope.title = '';
			$scope.link = '';
			$scope.author = '';
		}
	};

	$scope.incrementUpvotes = function(post) {
		posts.upvote(post);
	};

	$scope.decrementUpvotes = function(post) {
		posts.downvote(post);
	};

	$scope.removePost = function(post) {
		if (post.author === auth.currentUser()) {
			for (var i = 0; i < posts.posts.length; i++) {
				if (posts.posts[i]._id === post._id) {
					posts.remove(post, i);
				}
			}
			$scope.posts = posts.posts;
		}
	};
}]);

/* post detail controller */
app.controller('PostsCtrl', ['$scope', 'posts', 'post', 'auth', function($scope, posts, post, auth) {
	$scope.post = post;
	$scope.isLoggedIn = auth.isLoggedIn;

	$scope.addComment = function() {
		if ($scope.body) {
			posts.addComment(post._id, {
				body: $scope.body,
				author: $scope.author
			}).success(function(comment) {
				$scope.post.comments.push(comment);
			});
			$scope.body = '';
			$scope.author = '';
		}
	};

	$scope.incrementUpvotes = function(comment) {
		posts.upvoteComment(post, comment);
	};

	$scope.decrementUpvotes = function(comment) {
		posts.downvoteComment(post, comment);
	};
}]);