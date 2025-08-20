

async function generateImage(prompt) {
    try {
        const response = await fetch("https://api.deepai.org/api/text2img", {
            method: "POST",
            headers: {
                "Api-Key": "ea2cdb21-167a-4042-aea8-a87e8307c439", // Your DeepAI API key
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({ text: prompt })
        });

        const result = await response.json();

        if (result.output_url) {
            return result.output_url; // The generated image URL
        } else {
            console.error("Image generation failed:", result);
            return null;
        }
    } catch (error) {
        console.error("Error generating image:", error);
        return null;
    }
}


async function handleUserMessage(userMessage) {
    if (userMessage.toLowerCase().startsWith("image ")) {
        const prompt = userMessage.slice(6); // remove "image " from the start
        console.log("Generating image for:", prompt);

        const imageUrl = await generateImage(prompt);
        console.log("Image created:", imageUrl);

        // Here you can send the image URL back to the chat
        // Example: display it in the UI
        const img = document.createElement("img");
        img.src = imageUrl;
        img.alt = prompt;
        document.body.appendChild(img);
    } else {
        console.log("Regular chat message:", userMessage);
        // Handle normal AI text conversation here
    }
}
// This array will hold the conversation turns during this session
const conversationHistory = [];
function highlightWords(text) {
  return text.replace(/\*\*(.+?)\*\*/g, '<span class="highlight">$1</span>');
}

// Add this function anywhere above appendMessage
function highlightKeywords(text) {
  // Add more words as needed in the array
  const keywords = ["noun", "verb", "adjective", "pronoun", "adverb"];
  keywords.forEach(word => {
    // Regex for bolded word (e.g., **noun**)
    const regex = new RegExp(`\\*\\*(${word})\\*\\*`, "gi");
    text = text.replace(regex, `<span class="highlighted">$1</span>`);
  });
  return text;
}
document.getElementById('newChatBtn').onclick = function() {
  if (window.chatHistory) window.chatHistory = [];
  const chatBox = document.getElementById('chat-box');
  if (chatBox) chatBox.innerHTML = "";
  const input = document.getElementById('user-input');
  if (input) input.value = "";
  window.lastUserMessage = "";
};
function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file); // Keep full string, including "data:image/png;base64,..."
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
  });
}

// Track chat history for multi-turn context
let chatHistory = [];

async function sendImageToHuggingFace(base64Image, promptText) {
  // Build conversation context for multi-turn understanding
  const contextMessages = chatHistory.map(msg => {
    // Only include user and bot text, not images
    if (msg.className === "user" || msg.className === "bot") {
      // Remove HTML tags for context
      return `${msg.sender}: ${stripHTML(msg.text)}`;
    }
    return null;
  }).filter(Boolean);
  const fullPrompt = contextMessages.join("\n") + `\nYou: ${promptText}`;

  const response = await fetch("https://api-inference.huggingface.co/models/llava-hf/llava-1.5-7b-hf", {
    method: "POST",
    headers: {
      "Authorization": "Bearer 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",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      inputs: {
        image: base64Image,
        question: fullPrompt
      }
    })
  });

  const result = await response.json();
  return result;
}


// Handles image upload from chat UI, performs OCR, and sends result to AI
async function handleScreenshot(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async function () {
    const imageData = reader.result;
    // Show image in chat as a user message
    appendMessage("You", `<img src='${imageData}' alt='Uploaded image' style='max-width: 200px; border-radius: 10px;' />`, "user");
    appendMessage("DAV AI", "Extracting text from image...", "bot");
    // OCR using Tesseract
    if (window.Tesseract) {
      const result = await window.Tesseract.recognize(imageData, 'eng', {
        logger: m => console.log(m)
      });
      const extractedText = result.data.text.trim();
      if (!extractedText) {
        appendMessage("DAV AI", "❌ Could not read the question. Please upload a clearer image.", "bot");
        return;
      }
      // Show extracted text as a user message
      appendMessage("You", extractedText, "user");
      // Now send to your AI model
      let aiReply = await askGemini(extractedText);
      appendMessage("DAV AI", aiReply, "bot");
    } else {
      appendMessage("DAV AI", "❌ OCR library not loaded.", "bot");
    }
  };
  reader.readAsDataURL(file);
}
// ====== Long-Term Memory Storage ====== //
let longTermMemory = [];

// Load saved memory at start
function loadLongTermMemory() {
  const saved = localStorage.getItem("davLongTermMemory");
  if (saved) {
    try {
      longTermMemory = JSON.parse(saved);
    } catch (e) {
      console.error("Failed to parse saved long-term memory:", e);
      longTermMemory = [];
    }
  }
}
loadLongTermMemory();

// Save memory to localStorage
function saveLongTermMemory() {
  localStorage.setItem("davLongTermMemory", JSON.stringify(longTermMemory));
}

// Add a fact to long-term memory if it doesn't already exist
function rememberLongTerm(fact) {
  if (!longTermMemory.includes(fact)) {
    longTermMemory.push(fact);
    localStorage.setItem("longTermMemory", JSON.stringify(longTermMemory));
  }
}


// ====== Main Ask Function ====== //
async function askGemini(prompt) {
  try { // Check if the message starts with "remember"
    if (prompt.toLowerCase().startsWith("remember ")) {
      const fact = prompt.slice(9).trim();
      if (fact) {
        rememberLongTerm(fact);
        return `✅ Got it! I'll remember: "${fact}".`;
      }
    }

    // System message for creator info
    const systemMsg = `System: 
You are DAV AI, an advanced assistant based on Gemini 1.5 Flash. 
`;

    // Short-term memory: last 100 messages
    const contextMessages = chatHistory
      .filter(msg => msg.className === "user" || msg.className === "bot")
      .slice(-100)
      .map(msg => `${msg.sender}: ${stripHTML(msg.text)}`);

    // Long-term memory: persistent important facts
    const memorySection = longTermMemory.length > 0
      ? `\nLong-Term Memory:\n${longTermMemory.join("\n")}`
      : "";

    // Build final prompt
    const fullPrompt = [
      systemMsg,
      `Here are important facts remembered from past conversations:${memorySection}`,
      ...contextMessages,
      `You: ${prompt}`
    ].join("\n");

    // Send to Gemini API
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyBWbPgliADegJIxSqsUty7BPwmpn8sk74c",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }]
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("Gemini API error:", error);
      return "❌ No response from Gemini.";
    }

    const data = await response.json();
    if (
      data?.candidates?.length &&
      data.candidates[0].content?.parts?.length
    ) {
      const reply = data.candidates[0].content.parts[0].text;

      // Auto-save name if user says "my name is ..."
      const lowerPrompt = prompt.toLowerCase();
      if (lowerPrompt.startsWith("my name is")) {
        const name = prompt.substring(11).trim();
        rememberLongTerm(`User's name is ${name}`);
      }

      return reply;
    } else {
      console.error("Gemini API unexpected response:", data);
      return "❌ No response from Gemini.";
    }
  } catch (err) {
    console.error("Gemini API fetch error:", err);
    return "❌ No response from Gemini.";
  }
}
const API_KEY = "3132f458013676cb3b564683687d86ae05653de2";

async function handleMessage(message) {
    // Check if the message starts with "extract "
    if (message.toLowerCase().startsWith("extract ")) {
        const url = message.substring(8).trim();
        return await extractFromUrl(url);
    } else {
        return "Normal AI reply here...";
    }
}

async function extractFromUrl(url) {
    try {
        const apiUrl = `https://extractorapi.com/api/v1/extractor/?apikey=${API_KEY}&url=${encodeURIComponent(url)}`;
        const res = await fetch(apiUrl);
        const data = await res.json();

        if (data && data.text) {
            return `**${data.title || "No title"}**\n\n${data.text}`;
        } else {
            return "No content found for that URL.";
        }
    } catch (error) {
        console.error(error);
        return "Error extracting content.";
    }
}




const form = document.getElementById("chat-form");
const chatBox = document.getElementById("chat-box");
const input = document.getElementById("user-input");

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const userText = input.value.trim();
  if (userText === "") return;

  appendMessage("You", userText, "user");
  input.value = "";

  // Store last user message for regenerate button
  window.lastUserMessage = userText;

  setTimeout(async () => {
    let reply;

    if (userText.toLowerCase().startsWith("image:")) {
      const prompt = userText.slice(6).trim();
      reply = await generateImage(prompt);
    } else {
      // Try AI first
      try {
    reply = getAIResponse(userText); // 🔍 Try your logic first

if (reply.startsWith("❌")) {
  
  reply = await askGemini(userText);
}

      } catch {
        // fallback to local book logic
        reply = getAIResponse(userText);
      }

      speakText(stripHTML(reply));
    }

    appendMessage("DAV AI", reply, "bot");
  }, 500);
});


function cleanMarkdown(text) {
  // Replace ## headings
  text = text.replace(/^##\s*/gm, '<h2>');
  // Replace **bold**
  text = text.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  // Replace line breaks
  text = text.replace(/\n/g, '<br>');
  // Make https links clickable
  text = text.replace(/(https:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" style="color:#0078fe;text-decoration:underline;">$1</a>');
  return text;
}

function appendMessage(sender, text, className) {
  // Add message to chat history
  chatHistory.push({ sender, text, className });
  const wrapper = document.createElement("div");
  wrapper.classList.add("chat-wrapper", className);

  const msgDiv = document.createElement("div");
  msgDiv.classList.add("chat-message", className);
msgDiv.innerHTML = `<strong>${sender}:</strong><br>${cleanMarkdown(text)}`;
msgDiv.innerHTML = `<strong>${sender}:</strong><br>${cleanMarkdown(text)}`;

// Add DuckDuckGo search link for bot replies
if (className === "bot" && typeof window.lastUserMessage === "string" && window.lastUserMessage.trim() !== "") {
  const searchLink = document.createElement("div");
  searchLink.style.marginTop = "8px";
  searchLink.innerHTML = getWebSearchLink(window.lastUserMessage);
  msgDiv.appendChild(searchLink);
}


  const time = document.createElement("span");
  time.className = "msg-time";
  time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  wrapper.appendChild(msgDiv);
  wrapper.appendChild(time);

  if (className === "bot") {
    const buttonsDiv = document.createElement("div");
    buttonsDiv.className = "feedback-buttons";
    buttonsDiv.style.display = "flex";
    buttonsDiv.style.gap = "2px";
    buttonsDiv.style.marginTop = "4px";
    // Like button
    const likeBtn = document.createElement("button");
    likeBtn.title = "Like";
    likeBtn.innerHTML = "<svg width='18' height='18' viewBox='0 0 20 20' style='vertical-align:middle'><path d='M2 10v8h4V10H2zm16.2-2.4c-.3-.4-.8-.6-1.3-.6h-5.1l.7-3.4c.1-.5-.1-1-.5-1.3-.4-.3-.9-.3-1.3-.1l-1.2.7c-.4.2-.6.7-.5 1.1l.7 3.5H6c-.6 0-1 .4-1 1v8c0 .6.4 1 1 1h9c.5 0 .9-.3 1-.8l2-8c.1-.5 0-1-.3-1.3z' fill='#888'/></svg>";
    likeBtn.style.padding = "2px";
    likeBtn.style.background = "none";
    likeBtn.style.border = "none";
    likeBtn.style.cursor = "pointer";
    likeBtn.onclick = () => {
      likeBtn.classList.add("selected");
      dislikeBtn.classList.remove("selected");
    };
    // Dislike button
    const dislikeBtn = document.createElement("button");
    dislikeBtn.title = "Dislike";
    dislikeBtn.innerHTML = "<svg width='18' height='18' viewBox='0 0 20 20' style='vertical-align:middle'><path d='M18 10V2h-4v8h4zm-16.2 2.4c.3.4.8.6 1.3.6h5.1l-.7 3.4c-.1.5.1 1 .5 1.3.4.3.9.3 1.3.1l1.2-.7c.4-.2.6-.7.5-1.1l-.7-3.5H14c.6 0 1-.4 1-1v-8c0-.6-.4-1-1-1H5c-.5 0-.9.3-1 .8l-2 8c-.1.5 0 1 .3 1.3z' fill='#888'/></svg>";
    dislikeBtn.style.padding = "2px";
    dislikeBtn.style.background = "none";
    dislikeBtn.style.border = "none";
    dislikeBtn.style.cursor = "pointer";
    dislikeBtn.onclick = () => {
      dislikeBtn.classList.add("selected");
      likeBtn.classList.remove("selected");
    };
    // Regenerate button
    const regenBtn = document.createElement("button");
    regenBtn.title = "Regenerate";
    regenBtn.innerHTML = "<svg width='18' height='18' viewBox='0 0 20 20' style='vertical-align:middle'><path d='M10 2v2a6 6 0 1 1-6 6H2a8 8 0 1 0 8-8z' fill='#888'/></svg>";
    regenBtn.style.padding = "2px";
    regenBtn.style.background = "none";
    regenBtn.style.border = "none";
    regenBtn.style.cursor = "pointer";
    regenBtn.onclick = () => {
      // Regenerate response (re-call last AI)
      if (typeof window.lastUserMessage === 'string') {
        appendMessage("DAV AI", "Regenerating...", "bot");
        setTimeout(async () => {
          let reply = await askGemini(window.lastUserMessage);
          appendMessage("DAV AI", reply, "bot");
        }, 500);
      }
    };
    // Copy button
    const copyBtn = document.createElement("button");
    copyBtn.title = "Copy";
    copyBtn.innerHTML = "<svg width='18' height='18' viewBox='0 0 20 20' style='vertical-align:middle'><rect x='4' y='4' width='12' height='12' rx='2' fill='#888'/></svg>";
    copyBtn.style.padding = "2px";
    copyBtn.style.background = "none";
    copyBtn.style.border = "none";
    copyBtn.style.cursor = "pointer";
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(stripHTML(text));
      copyBtn.classList.add("selected");
      setTimeout(() => copyBtn.classList.remove("selected"), 800);
    };
    // Read aloud button
    const speakBtn = document.createElement("button");
    speakBtn.title = "Read aloud";
    speakBtn.innerHTML = "<svg width='18' height='18' viewBox='0 0 20 20' style='vertical-align:middle'><path d='M3 8v4h4l5 5V3L7 8H3z' fill='#888'/></svg>";
    speakBtn.style.padding = "2px";
    speakBtn.style.background = "none";
    speakBtn.style.border = "none";
    speakBtn.style.cursor = "pointer";
    speakBtn.onclick = () => speakText(stripHTML(text));

    buttonsDiv.appendChild(likeBtn);
    buttonsDiv.appendChild(dislikeBtn);
    buttonsDiv.appendChild(regenBtn);
    buttonsDiv.appendChild(copyBtn);
    buttonsDiv.appendChild(speakBtn);
    wrapper.appendChild(buttonsDiv);
  }

  chatBox.appendChild(wrapper);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function getAIResponse(message) {
  const msg = message.toLowerCase();
  const classMatch = msg.match(/class\s*([1-9]|1[0-2])/);
  const classNum = classMatch ? `Class ${classMatch[1]}` : null;

  if (msg.includes("bhasha abhyas") && msg.includes("class 5")) {
    return `Class 5 Bhasha Abhyas: <a href="https://drive.google.com/file/d/1ELgKoWlkj_YQimqUEFpopRkF-DOf02J-/view" target="_blank">Open Book</a>`;
  }
  if (msg.includes("my english reader") && msg.includes("class 5")) {
    return `Class 5 My English Reader: <a href="https://drive.google.com/file/d/1KBvpL0z3VgVt45lwBP-M_9v50VVn5tnA/view" target="_blank">Open Book</a>`;
  }
  if (msg.includes("surbhi") && msg.includes("class 5")) {
    return `Class 5 Surbhi: <a href="https://drive.google.com/file/d/1I_5m_mRJuWKiuWQ8A7bWlcorH7sJosw4/view" target="_blank">Open Book</a>`;
  }

  if (msg.match(/class\s*([1-7])\s*(books)?/)) {
    return showFullClassBooks(classNum);
  }

  const subjectMatch = msg.match(/(english (practice|reader|literature)?|maths?|science|sst|social|hindi( reader| abhyas)?|computer|g\.?k\.?|moral|value|sanskrit)/);
  const rawSubject = subjectMatch ? subjectMatch[0].toLowerCase() : null;

  if (classNum && rawSubject) {
    const subjects = Object.keys(bookData[classNum] || {});
    const match = subjects.find(sub => sub.toLowerCase().includes(rawSubject));
    if (match) {
      const url = bookData[classNum][match];
      return `📘 <strong>${classNum} - ${match}:</strong> <a href="${url}" target="_blank">Open Book</a>`;
    }
  }

  if (classNum && !rawSubject) {
    return showFullClassBooks(classNum);
  }

  if (msg.match(/(^|\s)(hello|hi|hey)(\s|$)/)) {
    return "Hello! I’m your DAV AI Assistant. Ask me for any DAV book like ‘Class 3 Science’ or ‘Class 1 books’.";
  }

  // If not found, suggest web search
  return "❌ Sorry, I couldn’t find that book. Try asking like: ‘class 4 hindi abhyas’ or ‘class 2 books’.<br>" + getWebSearchLink(message);
}

function showFullClassBooks(classNum) {
  if (!bookData[classNum]) return "❌ Class not found.";
  const books = bookData[classNum];
  let response = `📚 <strong>${classNum} Books:</strong><br>`;
  for (const subject in books) {
    response += `🔹 <strong>${subject}:</strong> <a href="${books[subject]}" target="_blank">Open Book</a><br>`;
  }
  return response;
}

// Helper to generate DuckDuckGo search link
function getWebSearchLink(query) {
  const url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
  return `<a href='${url}' target='_blank' style='color:#0078fe;text-decoration:underline;'>🔎 Search the web for "${stripHTML(query)}"</a>`;
}

function speakText(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-IN'; // Use 'hi-IN' for Hindi if needed
  speechSynthesis.speak(utterance);
}
function stripHTML(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}
