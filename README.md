# 📘 Facebook Group Media Crawler

This is a Node.js tool for crawling data (author, images, captions) from Facebook groups **public** or **private** (login required).

> ⚠️ **Note:** This tool only crawls posts that have **media attached** (currently support **photo**).
---

## 📦 Requirements

- **Node.js** version **≥ 18.16.0**

---

## ⚙️ Prerequisites

- A Facebook account with:
  - Language set to **Vietnamese**.
  - Already **joined** the target group.

---

## 🛠 How to Run

1. Clone this repository:
   ```bash
   git clone https://github.com/longvo04/fb-group-img-crawler
   cd fb-group-img-crawler
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Create a `.env` file from the provided example:
   ```bash
   cp .env.example .env
   ```

4. Run the crawler:
   ```bash
   node index.js
   ```
    👉 To run in silent mode (no console output):
      ```
      node index.js --mute
      ```

---

## 🔍 How to Get `START_URL`

1. Go to the main page of the Facebook group.
2. Click on **"File phương tiện"** (Media tab).
3. Select the **"Ảnh"** (Photos) tab.
4. Click on **any photo** to open it in a dedicated page.
5. The URL of that page should be `START_URL`.

---

## 🚀 How It Works

- Once started, the tool:
  - Navigates through each image in the media section.
  - Crawls post data (author, text, image paths, etc.).
  - Proceeds to the next image automatically.

- If the media is a video
  - It will skip to the next content.

- If the image is part of another post (e.g., shared from a multi-image post):
  - It will visit the original post to extract the full content.
  - Then **skip all other images** from the same post (to avoid duplication).

---


## 🧪 Example Data

```json
{
  "author": "John Doe",
  "userID": "1312312312314",
  "postUrl": "https://www.facebook.com/photo/?fbid=9283746510928374&set=g.3701984628374651",
  "permalink": "https://www.facebook.com/groups/3701984628374651/permalink/9283746510928374/",
  "title": "Lorem ipsum dolor sit amet",
  "imgPaths": ["3701984628374651_9283746510928374_1.jpg"]
}
```
### 🔍 Field Descriptions
| Field       | Description                                                                                                                         |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `author`    | Author name.                                                                                      |
| `userID`   | User's Id.                                                                            |
| `postUrl`   | Direct link to the Facebook photo page that was crawled.                                                                            |
| `permalink` | Permanent link to the full Facebook post (if available).
| `title`     | The caption or message content of the post.                                                                                         |
| `imgPaths`  | List of image filenames (downloaded).                                            |

---

## 📝 Notes

- This tool is for **educational purposes only**. Be mindful of Facebook's terms of service when using automation tools.
- It is recommended to run the script in a secure environment using test accounts or with proper authorization.
