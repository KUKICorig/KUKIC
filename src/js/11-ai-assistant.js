// ============================================================
// Вкладка ИИ-ассистента (DeepSeek API)
// (часть модуля mindustry-studio; оборачивается build.py)
// ============================================================

    // AI ASSISTANT TAB JS

    const AI_CONFIG = {
  apiKey: "dummy-key",
  apiUrl: "http://localhost:9655/v1/chat/completions"
};

    let lastAiResponseText = "";

    function buildAiSystemPrompt() {
      return "Ты — ассистент по созданию модов для игры Mindustry в формате JSON (система контента v7/v8). " +
        "Помогай писать, исправлять и улучшать JSON-описания блоков, юнитов, пуль и статус-эффектов. " +
        "Отвечай кратко, а если предлагаешь готовый JSON — оформляй его в блоке кода.";
    }

    async function sendAiRequest() {
      const promptText = aiPromptInput.value.trim();
      if (!promptText) {
        showToast("Введите промт перед отправкой");
        return;
      }
      if (!AI_CONFIG.apiKey) {
        aiStatusTag.textContent = "Нет API-ключа";
        aiStatusTag.style.color = "var(--accent-red)";
        aiResponseBox.textContent = "API-ключ не задан. Откройте исходный код файла, найдите константу AI_CONFIG " +
          "внутри <script> в самом низу файла, и вставьте свой ключ DeepSeek в поле apiKey.";
        return;
      }

      let userContent = promptText;
      if (aiIncludeCode.checked) {
        userContent += "\n\nТекущий JSON в редакторе (" + fileNameDisplay.textContent + "):\n```json\n" + editor.value + "\n```";
      }

      btnAiSend.disabled = true;
      aiStatusTag.textContent = "Отправка запроса...";
      aiStatusTag.style.color = "var(--accent-cyan)";
      aiResponseBox.textContent = "Ожидание ответа модели...";

      try {
        const response = await fetch(AI_CONFIG.apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + AI_CONFIG.apiKey
          },
          body: JSON.stringify({
            model: aiModelSelect.value,
            max_tokens: 2000,
            messages: [
              { role: "system", content: buildAiSystemPrompt() },
              { role: "user", content: userContent }
            ]
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error((data && data.error && data.error.message) || `HTTP ${response.status}`);
        }

        const resultText = (data.choices && data.choices[0] && data.choices[0].message &&
          data.choices[0].message.content || "").trim() || "(Пустой ответ модели)";

        lastAiResponseText = resultText;
        aiResponseBox.textContent = resultText;
        aiStatusTag.textContent = "Готово";
        aiStatusTag.style.color = "var(--accent-green)";
      } catch (err) {
        aiStatusTag.textContent = "Ошибка";
        aiStatusTag.style.color = "var(--accent-red)";
        aiResponseBox.textContent = "Не удалось получить ответ: " + err.message +
          "\n\nЕсли ошибка связана с CORS — прямые запросы к api.deepseek.com из браузера " +
          "могут быть ограничены; в этом случае потребуется небольшой серверный прокси.";
      } finally {
        btnAiSend.disabled = false;
      }
    }

    btnAiSend.addEventListener("click", sendAiRequest);

    function extractJsonFromAiResponse(text) {
      const match = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
      return match ? match[1].trim() : text;
    }

    btnAiInsert.addEventListener("click", () => {
      if (!lastAiResponseText) {
        showToast("Сначала получите ответ от ИИ");
        return;
      }
      const toInsert = extractJsonFromAiResponse(lastAiResponseText);
      const pos = editor.selectionStart;
      const val = editor.value;
      editor.value = val.substring(0, pos) + toInsert + val.substring(pos);
      updateEditorLines();
      validateAndAnalyze();
      schedulePersist();
      showToast("Ответ ИИ вставлен в редактор");
    });

    btnAiCopy.addEventListener("click", () => {
      if (!lastAiResponseText) {
        showToast("Сначала получите ответ от ИИ");
        return;
      }
      navigator.clipboard.writeText(lastAiResponseText).then(() => {
        showToast("Ответ ИИ скопирован в буфер обмена");
      }).catch(() => {
        showToast("Не удалось скопировать");
      });
    });
