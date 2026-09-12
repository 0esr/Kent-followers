"use strict";

const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, "{}");
}

function loadUsers() {
    try {
        return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
    } catch {
        return {};
    }
}

function saveUsers(users) {
    fs.writeFileSync(
        USERS_FILE,
        JSON.stringify(users, null, 2)
    );
}

function hashPassword(password) {
    return crypto
        .createHash("sha256")
        .update(password)
        .digest("hex");
}

function createToken() {
    return crypto.randomBytes(32).toString("hex");
}

const sessions = new Map();

/* =========================
   REGISTER
========================= */

app.post("/api/register", (req, res) => {
    const { username, password } = req.body;

    if (
        typeof username !== "string" ||
        typeof password !== "string"
    ) {
        return res.status(400).json({
            ok: false,
            error: "بيانات غير صحيحة"
        });
    }

    const cleanUsername = username
        .trim()
        .toLowerCase();

    if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(cleanUsername)) {
        return res.status(400).json({
            ok: false,
            error: "اسم المستخدم غير صالح"
        });
    }

    if (password.length < 6) {
        return res.status(400).json({
            ok: false,
            error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل"
        });
    }

    const users = loadUsers();

    if (users[cleanUsername]) {
        return res.status(409).json({
            ok: false,
            error: "الحساب موجود مسبقًا"
        });
    }

    users[cleanUsername] = {
        id: crypto.randomUUID(),
        username: cleanUsername,
        password: hashPassword(password),
        points: 0,
        completedTasks: 0,
        createdAt: Date.now(),
        lastPointTime: 0
    };

    saveUsers(users);

    res.json({
        ok: true,
        message: "تم إنشاء الحساب"
    });
});

/* =========================
   LOGIN
========================= */

app.post("/api/login", (req, res) => {
    const { username, password } = req.body;

    const users = loadUsers();
    const user = users[String(username || "").toLowerCase()];

    if (
        !user ||
        user.password !== hashPassword(String(password || ""))
    ) {
        return res.status(401).json({
            ok: false,
            error: "اسم المستخدم أو كلمة المرور غير صحيحة"
        });
    }

    const token = createToken();

    sessions.set(token, {
        username: user.username,
        createdAt: Date.now()
    });

    res.json({
        ok: true,
        token
    });
});

/* =========================
   AUTH
========================= */

function auth(req, res, next) {
    const token = req.headers.authorization?.replace(
        "Bearer ",
        ""
    );

    if (!token || !sessions.has(token)) {
        return res.status(401).json({
            ok: false,
            error: "غير مسجل الدخول"
        });
    }

    req.session = sessions.get(token);
    next();
}

/* =========================
   PROFILE
========================= */

app.get("/api/me", auth, (req, res) => {
    const users = loadUsers();
    const user = users[req.session.username];

    if (!user) {
        return res.status(404).json({
            ok: false
        });
    }

    res.json({
        ok: true,
        user: {
            id: user.id,
            username: user.username,
            points: user.points,
            completedTasks: user.completedTasks,
            createdAt: user.createdAt
        }
    });
});

/* =========================
   DAILY TASK
========================= */

app.post("/api/task", auth, (req, res) => {
    const users = loadUsers();
    const user = users[req.session.username];

    if (!user) {
        return res.status(404).json({
            ok: false
        });
    }

    const now = Date.now();

    /*
      حماية بسيطة:
      لا يمكن تنفيذ المهمة مرة أخرى
      قبل مرور 60 ثانية.
    */

    if (now - user.lastPointTime < 60000) {
        return res.status(429).json({
            ok: false,
            error: "انتظر قليلًا قبل تنفيذ مهمة جديدة"
        });
    }

    const reward = 10;

    user.points += reward;
    user.completedTasks += 1;
    user.lastPointTime = now;

    saveUsers(users);

    res.json({
        ok: true,
        reward,
        points: user.points
    });
});

/* =========================
   SPEND POINTS
========================= */

app.post("/api/spend", auth, (req, res) => {
    const amount = Number(req.body.amount);

    if (
        !Number.isInteger(amount) ||
        amount <= 0 ||
        amount > 1000000
    ) {
        return res.status(400).json({
            ok: false,
            error: "قيمة النقاط غير صحيحة"
        });
    }

    const users = loadUsers();
    const user = users[req.session.username];

    if (!user) {
        return res.status(404).json({
            ok: false
        });
    }

    if (user.points < amount) {
        return res.status(400).json({
            ok: false,
            error: "رصيد النقاط غير كافٍ"
        });
    }

    user.points -= amount;

    saveUsers(users);

    res.json({
        ok: true,
        spent: amount,
        points: user.points
    });
});

/* =========================
   LOGOUT
========================= */

app.post("/api/logout", auth, (req, res) => {
    const token = req.headers.authorization?.replace(
        "Bearer ",
        ""
    );

    sessions.delete(token);

    res.json({
        ok: true
    });
});

/* =========================
   START
========================= */

app.listen(PORT, "0.0.0.0", () => {
    console.log(`ESR server running on port ${PORT}`);
});