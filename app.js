//jshint esversion: 6
require('dotenv').config()
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const md5 = require('md5');
const ejs = require('ejs');
const app = express();
const session = require('express-session');
const passport = require('passport');
const passportLocal = require('passport-local')
const passportLocalMongoose = require('passport-local-mongoose')
const findOrCreate = require('mongoose-findorcreate')
const GoogleStrategy = require('passport-google-oauth20').Strategy;


mongoose.set('useCreateIndex', true);
console.log("Environment: ", app.get('env'));
app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(express.static("public"));
// const encrypt = require('mongoose-encryption');

//session stuff
const sess = {
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {}
}

if (app.get('env') === 'production') {
  app.set('trust proxy', 1) // trust first proxy
  sess.cookie.secure = true // serve secure cookies
}
app.use(session(sess))

//passport stuff
app.use(passport.initialize());
app.use(passport.session());

//db
mongoose.connect("mongodb://localhost:27017/user_api_DB", {
    useNewUrlParser: true,
    useCreateIndex: true
  })
  .then(() => console.log('Database Connected'))
  .catch(err => console.log(err));;


const userSchema = new mongoose.Schema({
  username: {
    type: String,
    // required: [true, "use a username id"]
  },
  password: {
    type: String,
    // required: [true, "use a password"]
  },
  googleId: {
    type: String,
  },
  email: {
    type: String,
  }
});

// const encKey = process.env.SOME_32BYTE_BASE64_STRING;
// const sigKey = process.env.SOME_64BYTE_BASE64_STRING;
// userSchema.plugin(encrypt, { encryptionKey: encKey, signingKey: sigKey, encryptedFields: ['password'] });
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);
const User = new mongoose.model('User', userSchema);

//passportLocalMongoose stuff

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/callback"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({
      googleId: profile.id
    }, function(err, user) {
      return cb(err, user);
    });
  }
));




// #######################################
//               Routes
// #######################################

app.get('/', function(req, res) {
  if (req.isAuthenticated()) {
    res.status(200).send({
      Successful: true,
      loggedIn: true
    })
  } else {
    res.status(200).send({
      Successful: true,
      loggedIn: false
    })
  }

});

app.get('/register', function(req, res) {
  console.log("---------------register get route-----------------");
  if (req.isAuthenticated()) {
    res.status(200).send({
      Successful: true,
      loggedIn: true
    })
  } else {
    res.status(200).send({
      Successful: true,
      loggedIn: false
    })
  }
});

app.post('/register', function(req, res) {
  // util.saveUser(req, res, User);
  // res.render('secrets');
  console.log("------------Register post route------------------");
  console.log(req.body.username, req.body.email, req.body.password);
  User.register({
    username: req.body.username,
    email: req.body.email
  }, req.body.password, function(err, user) {
    if (err) {
      console.log(err);
      res.status(500).send({
        Successful: false,
        loggedIn: false,
        messages: err
      });
    } else {
      passport.authenticate("local")(req, res, function() {
        res.status(200).send({
          Successful: true,
          loggedIn: true
        })
      });
    }
  });
});



app.get('/login', function(req, res) {
  console.log("---------------login get route--------------------");
  if(req.isAuthenticated()){
    res.status(200).send({
      Successful: true,
      loggedIn: true
    });
  }else{
    res.status(200).send({Successful: true, loggedIn: false});
  }
})

app.post('/login', function(req, res) {
  console.log("-------------------login post route---------------------");
  // util.getUser(req, res, User);
  console.log(req.body);
  const user = new User({
    username: req.body.username,
    password: req.body.password
  });
  passport.authenticate('local', function(err, user, info) {
    if (err) {
      return next(err);
    }
    if (!user) {
      console.log('user: ', user, 'err: ', err, 'info', info);
      return res.status(500).send({
        Successful: false,
        loggedIn: false,
        messages: info
      });
    }
    req.logIn(user, function(err) {
      if (err) {
        return next(err);
      }
      console.log("LoggedIn Successfully");
      return res.status(200).send({
        Successfull: true,
        loggedIn: true
      })
    });
  })(req, res, next = function(err) {
    console.log('err: ', err);
    res.status(500).send({
      Successfull: false,
      loggedIn: false
    })
  });
});

app.get('/logout', function(req, res) {
  console.log("------------------logout get route------------------");
  req.logout();
  res.redirect('/');
});

//create data page
app.get('/submit', function(req, res) {
  if (req.isAuthenticated()) {
    console.log("user is logged in ");
    res.status(200).send({
      Successful: true,
      loggedIn: true
    })
  } else {
    res.redirect('/login');
  }
});


//user is posting data to DB from create data page
app.post('/submit', function(req, res) {

  console.log("-------------------Submit POST Route------------------------");
  if (req.isAuthenticated()) {
    User.updateOne({
      _id: req.user.id
    }, {
      //updates this email as of now
      email: req.body.email
    }, function(err) {
      if (err) {
        res.status(500).send(err);
      } else {
        res.status(200).send({
          Successful: true,
          loggedIn: true
        })
      }
    });
  } else {
    res.redirect('/login');
  }

});

//show data to user if they are loggedIn else ask them to login
app.get('/secrets', function(req, res) {
  console.log("-------------------Secrets get route---------------------");
  if (req.isAuthenticated()) {
    User.find({
      "email": {
        $ne: null
      }
    }, function(err, foundUsers) {
      if (err) {
        console.log(err);
        res.status(500).send({
          Successfull: true,
          loggedIn: true
        })
      } else {
        if (foundUsers) {
          res.render('secrets', {
            usersWithSecrets: foundUsers
          });
        } else {
          res.redirect('/');
        }
      }
    });
  } else {
    res.redirect('/login')
  }
});



//Google authentication, both sign up and sign in with google
app.get('/auth/google', passport.authenticate('google', {
  scope: ['profile']
}));
//google calls this endpoint as a call back
app.get('/auth/google/callback', passport.authenticate('google', {
    failureRedirect: '/login'
  }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect(200).send({
      Successfull: true,
      loggedIn: true
    });
  });



//port settings
let port = process.env.PORT;
app.listen(3000 || port, function() {
  console.log("server started at port 3000 or " + port);
});
