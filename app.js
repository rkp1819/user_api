//jshint esversion: 6
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const md5 = require("md5");
const ejs = require("ejs");
const app = express();
const session = require("express-session");
const passport = require("passport");
const passportLocal = require("passport-local");
const passportLocalMongoose = require("passport-local-mongoose");
const findOrCreate = require("mongoose-findorcreate");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const util = require("util");

mongoose.set("useCreateIndex", true);
console.log("Environment: ", app.get("env"));
app.set("view engine", "ejs");
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);
app.use(bodyParser.json());
app.use(express.static("public"));
// const encrypt = require('mongoose-encryption');

//session stuff
const sess = {
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {},
};

if (app.get("env") === "production") {
  app.set("trust proxy", 1); // trust first proxy
  sess.cookie.secure = true; // serve secure cookies
}
app.use(session(sess));

//passport stuff
app.use(passport.initialize());
app.use(passport.session());

//db
mongoose
  .connect("mongodb://localhost:27017/user_api_DB", {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Database Connected"))
  .catch((err) => console.log(err));

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    trim: true,
    // required: [true, "use a username id"]
  },
  password: {
    type: String,
    // required: [true, "use a password"]
  },
  firstName: {
    type: String,
  },
  lastName: {
    type: String,
  },
  googleId: {
    type: String,
  },
  email: {
    type: String,
  },
  role: {
    type: String,
  },

  data: [mongoose.Schema.Types.Mixed],
});

// const encKey = process.env.SOME_32BYTE_BASE64_STRING;
// const sigKey = process.env.SOME_64BYTE_BASE64_STRING;
// userSchema.plugin(encrypt, { encryptionKey: encKey, signingKey: sigKey, encryptedFields: ['password'] });
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);
const User = new mongoose.model("User", userSchema);

//passportLocalMongoose stuff

passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  User.findById(id, function (err, user) {
    done(err, user);
  });
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/callback",
    },
    function (accessToken, refreshToken, profile, cb) {
      User.findOrCreate(
        {
          googleId: profile.id,
        },
        function (err, user) {
          return cb(err, user);
        }
      );
    }
  )
);

// #######################################
//               Routes
// #######################################

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  next();
});

app.get("/", function (req, res) {
  console.log("in / get route");
  if (req.isAuthenticated()) {
    console.log("req is authenticated");
    res.status(200).send({
      Successful: true,
      loggedIn: true,
    });
  } else {
    console.log("req is not authenticated");
    res.status(200).send({
      Successful: true,
      loggedIn: false,
    });
  }
});

app.get("/register", function (req, res) {
  console.log("---------------register get route-----------------");
  if (req.isAuthenticated()) {
    res.status(200).send({
      Successful: true,
      loggedIn: true,
    });
  } else {
    res.status(200).send({
      Successful: true,
      loggedIn: false,
    });
  }
});

app.post("/register", function (req, res) {
  // util.saveUser(req, res, User);
  // res.render('secrets');
  console.log("------------Register post route------------------");
  // console.log("req:::: "+util.inspect(req, { depth: null }));
  console.log(req.body);
  console.log(
    req.body.username,
    req.body.email,
    req.body.password,
    req.body.role,
    req.body.firstName,
    req.body.lastName
  );
  User.register(
    {
      username: req.body.username,
      email: req.body.email,
      role: req.body.role,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
    },
    req.body.password,
    function (err, user, info) {
      if (err) {
        console.log(err);
        res.status(200).send({
          Successful: false,
          loggedIn: false,
          messages: info,
        });
      } else {
        passport.authenticate("local")(req, res, function () {
          res.status(200).send({
            Successful: true,
            loggedIn: true,
          });
        });
      }
    }
  );
});

app.get("/login", function (req, res) {
  console.log("---------------login get route--------------------");
  if (req.isAuthenticated()) {
    res.status(200).send({
      Successful: true,
      loggedIn: true,
    });
  } else {
    res.status(200).send({
      Successful: true,
      loggedIn: false,
    });
  }
});

app.post("/login", function (req, res) {
  console.log("-------------------login post route---------------------");
  // util.getUser(req, res, User);
  console.log(req.body);
  const user = new User({
    username: req.body.username,
    email: req.body.email,
    role: req.body.role,
  });
  passport.authenticate("local", function (err, user, info) {
    if (err) {
      //handle err with return next();
      return res.status(500).send({ error: err });
    }
    if (!user) {
      console.log("user: ", user, "err: ", err, "info", info);
      return res.status(200).send({
        Successful: false,
        loggedIn: false,
        messages: info,
      });
    }
    req.logIn(user, function (err) {
      if (err) {
        return res.status(500).send({ error: err });
      }
      console.log("LoggedIn Successfully");
      return res.status(200).send({
        Successful: true,
        loggedIn: true,
      });
    });
  })(
    req,
    res,
    (next = function (err) {
      console.log("err: ", err);
      res.status(200).send({
        Successful: false,
        loggedIn: false,
      });
    })
  );
});

app.get("/logout", function (req, res) {
  console.log("------------------/logout get route-----------------");
  req.logout();
  res.redirect("/");
});

//user seeks data from create data page
app.get("/getData", function (req, res) {
  console.log("-------------------/getData get route---------------");
  if (req.isAuthenticated()) {
    //role=true is admin
    try {
      console.log("role: " + Boolean(req.body.role));
      User.findOne({ username: req.body.username }, {}, function (
        err,
        foundUser
      ) {
        if (err) {
          res.status(500).send({ error: err });
        } else {
          console.log("found: ", foundUser.username);
          if (foundUser.data.role == true) {
            console.log("role: " + foundUser.data.role);
            res.redirect("/getAllData");
          } else {
            res.status(200).send({
              Successful: true,
              loggedIn: true,
              data: foundUser,
            });
          }
        }
      });
    } catch (err) {
      console.log(err);
      res.status(500).send({ error: err });
    }
  } else {
    res.redirect("/login");
  }
});

//user is posting data to DB from create data page
app.post("/postData", function (req, res) {
  console.log(
    "-------------------/postData POST Route------------------------"
  );
  if (req.isAuthenticated()) {
    User.updateOne(
      {
        username: req.body.username,
      },
      {
        //updates data i.e tasks
        data: req.body.tasks,
      },
      function (err) {
        if (err) {
          res.status(500).send({ error: err });
        } else {
          res.status(200).send({
            Successful: true,
            loggedIn: true,
          });
        }
      }
    );
  } else {
    res.redirect("/login");
  }
});

//show data to user if they are loggedIn else ask them to login
app.get("/getAllData", function (req, res) {
  console.log("-------------------/getAllData get route---------------------");
  if (req.isAuthenticated()) {
    //we expect username as email is the unique identifier of user
    User.find(
      {
        username: {
          $ne: null,
        },
      },
      function (err, foundUsers) {
        if (err) {
          console.log(err);
          res.status(500).send({ error: err });
        } else {
          if (foundUsers) {
            res.status(200).send({
              Successful: true,
              loggedIn: true,
              data: foundUsers,
            });
          } else {
            res.redirect("/");
          }
        }
      }
    );
  } else {
    res.redirect("/login");
  }
});

//Google authentication, both sign up and sign in with google
app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile"],
  })
);
//google calls this endpoint as a call back
app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login",
  }),
  function (req, res) {
    // Successful authentication, redirect home.
    res.redirect(200).send({
      Successful: true,
      loggedIn: true,
    });
  }
);

//port settings
let port = process.env.PORT;
app.listen(3000, function () {
  console.log("server started at port 3000");
});
