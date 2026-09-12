const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ===============================
// الملفات
// ===============================
const dataDir = path.join(__dirname, "data");
const usersFile = path.join(dataDir, "users.json");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(usersFile)) {
  fs.writeFileSync(usersFile, "[]", "utf8");
}

function loadUsers() {
  try {
    return JSON.parse(fs.readFileSync(usersFile, "utf8"));
  } catch {
    return [];
  }
}

function saveUsers(users) {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2), "utf8");
}

// ===============================
// الجلسات
// ===============================
const sessions = new Map();

function hashPassword(password) {
  return crypto
    .createHash("sha256")
    .update(password)
    .digest("hex");
}

function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

// ===============================
// الصفحة الرئيسية
// ===============================
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ESR Points</title>
<style>
body{
  margin:0;
  background:#111;
  color:#fff;
  font-family:Arial,sans-serif;
  display:flex;
  align-items:center;
  justify-content:center;
  min-height:100vh;
}
.box{
  text-align:center;
  padding:30px;
}
h1{margin-bottom:10px}
p{color:#aaa}
</style>
</head>
<body>
<div class="box">
  <h1>ESR Points</h1>
  <p>السيرفر يعمل بنجاح ✅</p>
  <p>client.js متاح للتحميل.</p>
</div>
</body>
</html>
  `);
});

// ===============================
// ملف القائمة
// ===============================
app.get("/client.js", (req, res) => {
  res.type("application/javascript");
  res.set("Cache-Control", "no-store");

  const clientPath = path.join(__dirname, "public", "client.js");

  if (!fs.existsSync(clientPath)) {
    return res.status(404).send(
      'console.error("client.js غير موجود في مجلد public");'
    );
  }

  res.sendFile(clientPath);
});

// ===============================
// تسجيل حساب
// ===============================
app.post("/api/register", (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");

  if (username.length < 3 || username.length > 30) {
    return res.status(400).json({
      error: "اسم المستخدم يجب أن يكون بين 3 و30 حرفًا"
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل"
    });
  }

  const users = loadUsers();

  if (
    users.some(
      u => u.username.toLowerCase() === username.toLowerCase()
    )
  ) {
    return res.status(409).json({
      error: "اسم المستخدم مستخدم بالفعل"
    });
  }

  const user = {
    id: crypto.randomUUID(),
    username,
    passwordHash: hashPassword(password),
    points: 0,
    completedTasks: 0,
    createdAt: new Date().toISOString(),
    lastPointTime: 0
  };

  users.push(user);
  saveUsers(users);

  res.json({
    success: true,
    message: "تم إنشاء الحساب",
    user: {
      id: user.id,
      username: user.username,
      points: user.points,
      completedTasks: user.completedTasks
    }
  });
});

// ===============================
// تسجيل الدخول
// ===============================
app.post("/api/login", (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");

  const users = loadUsers();

  const user = users.find(
    u => u.username.toLowerCase() === username.toLowerCase()
  );

  if (!user || user.passwordHash !== hashPassword(password)) {
    return res.status(401).json({
      error: "بيانات الدخول غير صحيحة"
    });
  }

  const token = createToken();

  sessions.set(token, {
    userId: user.id,
    createdAt: Date.now()
  });

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      username: user.username,
      points: user.points,
      completedTasks: user.completedTasks
    }
  });
});

// ===============================
// حماية API
// ===============================
function auth(req, res, next) {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "غير مصرح"
    });
  }

  const token = header.slice(7);
  const session = sessions.get(token);

  if (!session) {
    return res.status(401).json({
      error: "الجلسة غير صالحة"
    });
  }

  const users = loadUsers();
  const user = users.find(u => u.id === session.userId);

  if (!user) {
    sessions.delete(token);

    return res.status(401).json({
      error: "الحساب غير موجود"
    });
  }

  req.user = user;
  req.token = token;

  next();
}

// ===============================
// بيانات الحساب
// ===============================
app.get("/api/me", auth, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.id,
      username: req.user.username,
      points: req.user.points,
      completedTasks: req.user.completedTasks,
      createdAt: req.user.createdAt
    }
  });
});

// ===============================
// كسب النقاط
// ===============================
app.post("/api/task", auth, (req, res) => {
  const users = loadUsers();

  const user = users.find(u => u.id === req.user.id);

  if (!user) {
    return res.status(404).json({
      error: "الحساب غير موجود"
    });
  }

  const now = Date.now();

  // دقيقة واحدة بين كل مهمة
  if (now - user.lastPointTime < 60000) {
    const remaining = Math.ceil(
      (60000 - (now - user.lastPointTime)) / 1000
    );

    return res.status(429).json({
      error: `انتظر ${remaining} ثانية`
    });
  }

  user.points += 10;
  user.completedTasks += 1;
  user.lastPointTime = now;

  saveUsers(users);

  res.json({
    success: true,
    points: user.points,
    earned: 10,
    completedTasks: user.completedTasks
  });
});

// ===============================
// صرف النقاط
// ===============================
app.post("/api/spend", auth, (req, res) => {
  const amount = Number(req.body.amount);

  if (!Number.isInteger(amount) || amount <= 0) {
    return res.status(400).json({
      error: "قيمة النقاط غير صحيحة"
    });
  }

  const users = loadUsers();
  const user = users.find(u => u.id === req.user.id);

  if (!user) {
    return res.status(404).json({
      error: "الحساب غير موجود"
    });
  }

  if (user.points < amount) {
    return res.status(400).json({
      error: "النقاط غير كافية"
    });
  }

  user.points -= amount;

  saveUsers(users);

  res.json({
    success: true,
    points: user.points,
    spent: amount
  });
});

// ===============================
// تسجيل الخروج
// ===============================
app.post("/api/logout", auth, (req, res) => {
  sessions.delete(req.token);

  res.json({
    success: true
  });
});

// ===============================
// تشغيل السيرفر
// ===============================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`ESR Points Server running on port ${PORT}`);
});