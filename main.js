const OLLAMA_CHAT_URL = 'http://localhost:11434/api/chat';
const MODEL_NAME = 'gemma3:4b';

const imageInput = document.querySelector('#image-input');
const imagePreview = document.querySelector('#image-preview');
const emptyPreview = document.querySelector('#empty-preview');
const fileName = document.querySelector('#file-name');
const describeButton = document.querySelector('#describe-button');
const buttonLabel = document.querySelector('.button-label');
const buttonSpinner = document.querySelector('.button-spinner');
const statusMessage = document.querySelector('#status');
const responseBox = document.querySelector('#response');

let selectedImage = null;
let previewUrl = null;

imageInput.addEventListener('change', () => {
  const file = imageInput.files && imageInput.files[0];
  selectedImage = null;
  clearDescription();

  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }

  if (!file) {
    imagePreview.hidden = true;
    emptyPreview.hidden = false;
    fileName.hidden = true;
    setStatus('Select an image to get started.', '');
    return;
  }

  if (!file.type.startsWith('image/')) {
    imagePreview.hidden = true;
    emptyPreview.hidden = false;
    fileName.hidden = true;
    imageInput.value = '';
    setStatus('That file does not appear to be an image. Choose an image file and try again.', 'error');
    return;
  }

  selectedImage = file;
  previewUrl = URL.createObjectURL(file);
  imagePreview.src = previewUrl;
  imagePreview.hidden = false;
  emptyPreview.hidden = true;
  fileName.textContent = file.name;
  fileName.hidden = false;
  setStatus('Image ready. Select “Describe image” when you’re ready.', '');
});

describeButton.addEventListener('click', describeImage);

async function describeImage() {
  if (!selectedImage) {
    setStatus('Please choose an image before asking for a description.', 'error');
    imageInput.focus();
    return;
  }

  setLoading(true);
  clearDescription();
  setStatus('Ollama is analyzing your image. This may take a little while.', 'loading');

  try {
    const imageBase64 = await fileToBase64(selectedImage);
    const response = await fetch(OLLAMA_CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL_NAME,
        stream: false,
        messages: [{
          role: 'user',
          content: 'Describe what you see in this image. Be clear and concise, and mention the main subjects and setting.',
          images: [imageBase64]
        }]
      })
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error || `Ollama returned HTTP ${response.status}.`);
    }

    const description = result.message && result.message.content;
    if (typeof description !== 'string' || !description.trim()) {
      throw new Error('Ollama responded, but the response did not include a description.');
    }

    const paragraph = document.createElement('p');
    paragraph.className = 'description-text';
    paragraph.textContent = description.trim();
    responseBox.replaceChildren(paragraph);
    setStatus('Image described successfully.', 'success');
  } catch (error) {
    console.error('Image description request failed:', error);
    showRequestError(error);
  } finally {
    setLoading(false);
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== 'string' || !dataUrl.includes(',')) {
        reject(new Error('The selected image could not be prepared for Ollama.'));
        return;
      }
      resolve(dataUrl.slice(dataUrl.indexOf(',') + 1));
    });
    reader.addEventListener('error', () => reject(new Error('The browser could not read this image file.')));
    reader.readAsDataURL(file);
  });
}

function showRequestError(error) {
  const detail = String(error && error.message ? error.message : error);
  let message = `Could not describe the image. ${detail}`;

  if (detail.includes('Failed to fetch') || detail.includes('NetworkError')) {
    message = 'Could not reach Ollama. Make sure Ollama is running at localhost:11434 and that its browser-origin settings allow this page.';
  } else if (/not found|pull model|model .*does not exist/i.test(detail)) {
    message = `The model “${MODEL_NAME}” may not be installed. In Terminal, run: ollama pull ${MODEL_NAME}`;
  }

  responseBox.replaceChildren(Object.assign(document.createElement('p'), {
    className: 'response-placeholder',
    textContent: message
  }));
  setStatus('Something went wrong. Check the message below and try again.', 'error');
}

function clearDescription() {
  responseBox.replaceChildren(Object.assign(document.createElement('p'), {
    className: 'response-placeholder',
    textContent: 'Your image description will show up here after analysis.'
  }));
}

function setStatus(message, state) {
  statusMessage.textContent = message;
  if (state) statusMessage.dataset.state = state;
  else delete statusMessage.dataset.state;
}

function setLoading(isLoading) {
  describeButton.disabled = isLoading;
  imageInput.disabled = isLoading;
  buttonLabel.textContent = isLoading ? 'Analyzing image…' : 'Describe image';
  buttonSpinner.hidden = !isLoading;
}
