# SoloFit — Backend Integration Guide

You have two solid options. Pick one.

---

## Option A: Firebase (faster, recommended for this)

Firebase handles auth, data, and serverless functions all in one. Free tier is generous enough for personal projects.

### 1. Set up the project

```bash
npm install -g firebase-tools
firebase login
firebase init
# Choose: Hosting, Authentication, Firestore, Functions
```

### 2. Replace localStorage with Firebase Auth + Firestore

In your `script.js`, replace the `saveState` / `loadState` helpers:

```javascript
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "...",         // from your Firebase console
  authDomain: "...",
  projectId: "...",
  // etc.
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function saveState(s) {
  const user = auth.currentUser;
  if (!user) return localStorage.setItem('solofit_v1', JSON.stringify(s));
  await setDoc(doc(db, 'users', user.uid), s);
}

async function loadState() {
  const user = auth.currentUser;
  if (!user) return null;
  const snap = await getDoc(doc(db, 'users', user.uid));
  return snap.exists() ? snap.data() : null;
}
```

Replace the signup/login form handlers to use:

```javascript
// signup
await createUserWithEmailAndPassword(auth, email, password);

// login
await signInWithEmailAndPassword(auth, email, password);

// logout
await signOut(auth);
```

### 3. AI Coach as a Cloud Function

Create `functions/index.js`:

```javascript
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const Anthropic = require('@anthropic-ai/sdk');

const claudeKey = defineSecret('CLAUDE_API_KEY');

exports.coach = onRequest({ secrets: [claudeKey], cors: true }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('POST only');

  const { message, context } = req.body;
  const client = new Anthropic({ apiKey: claudeKey.value() });

  const systemPrompt = `You are an AI fitness coach in SoloFit, a Solo Leveling themed
training app. Respond in 2-4 sentences, direct and practical. Use the user's context to
personalize. The user follows a halal diet (no pork). Their PPL split is auto-detected by
weekday. Their goal is visible abs by July 26, 2026.

User context:
${JSON.stringify(context, null, 2)}`;

  try {
    const result = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: 'user', content: message }]
    });

    const reply = result.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
```

Set your API key as a secret:

```bash
firebase functions:secrets:set CLAUDE_API_KEY
# paste the key when prompted
firebase deploy --only functions
```

### 4. Update `firebase.json` to route `/api/ai/coach` to the function

```json
{
  "hosting": {
    "public": "solofit",
    "rewrites": [
      { "source": "/api/ai/coach", "function": "coach" }
    ]
  }
}
```

Done. The frontend already calls `/api/ai/coach`, so no JS changes needed.

---

## Option B: Your Go backend

If you want to keep everything in your Far & Myth Go/Gin stack:

```go
// handler/ai_coach.go
package handler

import (
    "encoding/json"
    "net/http"
    "github.com/anthropics/anthropic-sdk-go"
)

type CoachRequest struct {
    Message string                 `json:"message"`
    Context map[string]interface{} `json:"context"`
}

type CoachResponse struct {
    Reply string `json:"reply"`
}

func CoachHandler(client *anthropic.Client) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        var req CoachRequest
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
            http.Error(w, "bad request", 400)
            return
        }

        ctxJSON, _ := json.MarshalIndent(req.Context, "", "  ")
        systemPrompt := `You are an AI fitness coach in SoloFit, a Solo Leveling themed
training app. Respond in 2-4 sentences, direct and practical. The user follows
a halal diet (no pork). User context: ` + string(ctxJSON)

        msg, err := client.Messages.New(r.Context(), anthropic.MessageNewParams{
            Model:     anthropic.F("claude-haiku-4-5-20251001"),
            MaxTokens: anthropic.F(int64(400)),
            System:    anthropic.F([]anthropic.TextBlockParam{
                anthropic.NewTextBlock(systemPrompt),
            }),
            Messages: anthropic.F([]anthropic.MessageParam{
                anthropic.NewUserMessage(anthropic.NewTextBlock(req.Message)),
            }),
        })
        if err != nil {
            http.Error(w, err.Error(), 500)
            return
        }

        reply := ""
        for _, block := range msg.Content {
            if block.Type == "text" {
                reply += block.Text
            }
        }

        json.NewEncoder(w).Encode(CoachResponse{Reply: reply})
    }
}
```

Mount it on your router:

```go
r.POST("/api/ai/coach", gin.WrapF(handler.CoachHandler(client)))
```

For auth, add bcrypt + JWT handlers for `/api/auth/signup` and `/api/auth/login`. Store users in Postgres with `gorm`. The frontend already has the fetch stubs ready.

---

## Which to choose?

**Pick Firebase if:** you want it live tonight, you don't want to run another server, free tier is enough.

**Pick Go if:** you want everything in one stack, you want full SQL control, you're already running infra for other Far & Myth projects.

Either way, the frontend doesn't change — it just talks to `/api/ai/coach` and Firebase Auth or your Go auth endpoints. The whole client is backend-agnostic.

---

## Why not call Claude/OpenAI directly from the browser?

Because API keys would be visible in DevTools → Network → request headers. Anyone could grab them and run up your bill. The backend exists specifically to hold the key and forward requests.

If you ever see a tutorial telling you to put `OPENAI_API_KEY` in frontend JavaScript, close it.
