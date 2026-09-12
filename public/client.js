(() => {
    "use strict";

    const OLD_ID = "__ESR_POINTS_PANEL__";

    document.getElementById(OLD_ID)?.remove();

    const style = document.createElement("style");

    style.textContent = `
        #${OLD_ID} * {
            box-sizing: border-box;
            font-family: Arial, sans-serif;
        }

        #${OLD_ID} .esr-button {
            position: fixed;
            right: 16px;
            bottom: 20px;
            width: 52px;
            height: 52px;
            border-radius: 50%;
            border: 0;
            background: #111;
            color: white;
            font-size: 22px;
            z-index: 2147483647;
            box-shadow: 0 5px 25px rgba(0,0,0,.35);
        }

        #${OLD_ID} .esr-panel {
            position: fixed;
            right: 14px;
            bottom: 82px;
            width: min(330px, calc(100vw - 28px));
            max-height: 75vh;
            overflow-y: auto;
            background: #111;
            color: white;
            border-radius: 18px;
            padding: 16px;
            z-index: 2147483646;
            display: none;
            box-shadow: 0 10px 40px rgba(0,0,0,.45);
        }

        #${OLD_ID} .esr-panel.open {
            display: block;
        }

        #${OLD_ID} h2 {
            margin: 0 0 14px;
            font-size: 19px;
        }

        #${OLD_ID} input {
            width: 100%;
            padding: 12px;
            margin: 5px 0;
            border: 1px solid #333;
            border-radius: 10px;
            background: #1c1c1c;
            color: white;
            outline: none;
        }

        #${OLD_ID} button.action {
            width: 100%;
            padding: 12px;
            margin-top: 7px;
            border: 0;
            border-radius: 10px;
            background: #fff;
            color: #111;
            font-weight: bold;
        }

        #${OLD_ID} .card {
            background: #1b1b1b;
            padding: 13px;
            border-radius: 12px;
            margin-bottom: 10px;
        }

        #${OLD_ID} .points {
            font-size: 28px;
            font-weight: bold;
        }

        #${OLD_ID} .error {
            color: #ff7777;
            margin-top: 8px;
            font-size: 13px;
        }

        #${OLD_ID} .success {
            color: #75e6a8;
            margin-top: 8px;
            font-size: 13px;
        }
    `;

    document.head.appendChild(style);

    const root = document.createElement("div");

    root.id = OLD_ID;

    root.innerHTML = `
        <button class="esr-button">★</button>

        <div class="esr-panel">

            <div id="loginBox">

                <h2>ESR Points</h2>

                <input
                    id="esrUsername"
                    placeholder="اسم المستخدم"
                    autocomplete="username"
                >

                <input
                    id="esrPassword"
                    type="password"
                    placeholder="كلمة المرور"
                    autocomplete="current-password"
                >

                <button class="action" id="esrLogin">
                    تسجيل الدخول
                </button>

                <button class="action" id="esrRegister">
                    إنشاء حساب
                </button>

                <div id="esrMessage"></div>

            </div>

            <div id="userBox" style="display:none">

                <h2>حسابي</h2>

                <div class="card">
                    <div id="esrUser"></div>
                    <div class="points" id="esrPoints">0</div>
                    <small>نقطة</small>
                </div>

                <div class="card">
                    المهام المكتملة:
                    <strong id="esrTasks">0</strong>
                </div>

                <button class="action" id="esrTask">
                    🎯 تنفيذ مهمة +10
                </button>

                <button class="action" id="esrPromote">
                    📣 الترويج
                </button>

                <button class="action" id="esrLogout">
                    تسجيل الخروج
                </button>

                <div id="esrUserMessage"></div>

            </div>

        </div>
    `;

    document.body.appendChild(root);

    const API = location.origin + "/api";

    let token = localStorage.getItem("__ESR_TOKEN__");

    const panel = root.querySelector(".esr-panel");

    root.querySelector(".esr-button").onclick = () => {
        panel.classList.toggle("open");
    };

    function message(text, success = false) {
        const box = root.querySelector("#esrMessage");

        box.className = success ? "success" : "error";
        box.textContent = text;
    }

    async function request(url, options = {}) {
        options.headers = {
            "Content-Type": "application/json",
            ...(options.headers || {})
        };

        if (token) {
            options.headers.Authorization =
                "Bearer " + token;
        }

        const response = await fetch(API + url, options);

        return response.json();
    }

    async function loadProfile() {
        if (!token) return;

        const data = await request("/me");

        if (!data.ok) {
            token = null;
            localStorage.removeItem("__ESR_TOKEN__");
            return;
        }

        root.querySelector("#loginBox").style.display = "none";
        root.querySelector("#userBox").style.display = "block";

        root.querySelector("#esrUser").textContent =
            "@" + data.user.username;

        root.querySelector("#esrPoints").textContent =
            data.user.points;

        root.querySelector("#esrTasks").textContent =
            data.user.completedTasks;
    }

    root.querySelector("#esrLogin").onclick = async () => {

        const username =
            root.querySelector("#esrUsername").value;

        const password =
            root.querySelector("#esrPassword").value;

        const data = await request("/login", {
            method: "POST",
            body: JSON.stringify({
                username,
                password
            })
        });

        if (!data.ok) {
            message(data.error);
            return;
        }

        token = data.token;

        localStorage.setItem(
            "__ESR_TOKEN__",
            token
        );

        message("تم تسجيل الدخول", true);

        await loadProfile();
    };

    root.querySelector("#esrRegister").onclick = async () => {

        const username =
            root.querySelector("#esrUsername").value;

        const password =
            root.querySelector("#esrPassword").value;

        const data = await request("/register", {
            method: "POST",
            body: JSON.stringify({
                username,
                password
            })
        });

        if (!data.ok) {
            message(data.error);
            return;
        }

        message(
            "تم إنشاء الحساب، سجل الدخول الآن",
            true
        );
    };

    root.querySelector("#esrTask").onclick = async () => {

        const data = await request("/task", {
            method: "POST"
        });

        const box =
            root.querySelector("#esrUserMessage");

        if (!data.ok) {
            box.className = "error";
            box.textContent = data.error;
            return;
        }

        box.className = "success";
        box.textContent =
            `تمت إضافة ${data.reward} نقطة`;

        await loadProfile();
    };

    root.querySelector("#esrLogout").onclick = async () => {

        await request("/logout", {
            method: "POST"
        });

        token = null;

        localStorage.removeItem(
            "__ESR_TOKEN__"
        );

        root.querySelector("#userBox").style.display = "none";
        root.querySelector("#loginBox").style.display = "block";
    };

    root.querySelector("#esrPromote").onclick = () => {
        const box =
            root.querySelector("#esrUserMessage");

        box.className = "success";
        box.textContent =
            "نظام الترويج سيتم ربطه لاحقًا برصيد النقاط.";
    };

    loadProfile();

})();