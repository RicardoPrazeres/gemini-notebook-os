// Audio Overview / Podcast Player with Speech Synthesis and Waveform
class AudioOverviewPlayer {
  constructor() {
    this.isPlaying = false;
    this.isPaused = false;
    this.currentDialogue = [];
    this.currentIndex = 0;
    this.playbackRate = 1.0;
    this.voices = [];
    this.maleVoice = null;
    this.femaleVoice = null;

    this.playBtn = document.getElementById("btn-podcast-play");
    this.playIcon = document.getElementById("play-icon");
    this.playLabel = document.getElementById("play-label");
    this.waveform = document.getElementById("audio-waveform");
    this.speedSelect = document.getElementById("audio-speed-select");

    this.initVoices();
    this.attachEvents();
  }

  initVoices() {
    const loadVoices = () => {
      this.voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
      // Find PT-BR or EN voices
      const ptVoices = this.voices.filter(v => v.lang.includes("pt") || v.lang.includes("PT"));
      const enVoices = this.voices.filter(v => v.lang.includes("en") || v.lang.includes("EN"));
      
      const candidateVoices = ptVoices.length > 0 ? ptVoices : enVoices;

      // Assign male and female
      this.femaleVoice = candidateVoices.find(v => v.name.toLowerCase().includes("maria") || v.name.toLowerCase().includes("luciana") || v.name.toLowerCase().includes("female") || v.name.toLowerCase().includes("zira") || v.name.toLowerCase().includes("victoria")) || candidateVoices[0] || null;
      this.maleVoice = candidateVoices.find(v => v.name.toLowerCase().includes("daniel") || v.name.toLowerCase().includes("felipe") || v.name.toLowerCase().includes("male") || v.name.toLowerCase().includes("david") || v.name.toLowerCase().includes("george")) || candidateVoices[1] || candidateVoices[0] || null;
    };

    loadVoices();
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  attachEvents() {
    if (this.playBtn) {
      this.playBtn.addEventListener("click", () => this.togglePlay());
    }
    if (this.speedSelect) {
      this.speedSelect.addEventListener("change", (e) => {
        this.playbackRate = parseFloat(e.target.value) || 1.0;
      });
    }
  }

  setDialogue(dialogueData) {
    this.currentDialogue = dialogueData.dialogue || [];
    this.currentIndex = 0;
    this.stop();
  }

  togglePlay() {
    if (!window.speechSynthesis) {
      alert("Seu navegador não suporta síntese de áudio.");
      return;
    }

    if (this.isPlaying) {
      this.stop();
    } else {
      if (this.currentDialogue.length === 0) {
        // Trigger podcast generation if not yet generated
        window.StudioManager.triggerAction("podcast");
        return;
      }
      this.play();
    }
  }

  play() {
    this.isPlaying = true;
    this.playIcon.textContent = "⏹";
    this.playLabel.textContent = "Parar Podcast";
    this.waveform.classList.add("playing");
    this.speakNextLine();
  }

  speakNextLine() {
    if (!this.isPlaying) return;

    if (this.currentIndex >= this.currentDialogue.length) {
      this.stop();
      window.App.showToast("🎙️ Episódio do Podcast concluído!", "success");
      return;
    }

    const line = this.currentDialogue[this.currentIndex];
    const utterance = new SpeechSynthesisUtterance(line.text);
    utterance.rate = this.playbackRate;

    // Pick voice by gender
    if (line.gender === "female" && this.femaleVoice) {
      utterance.voice = this.femaleVoice;
      utterance.pitch = 1.1;
    } else if (this.maleVoice) {
      utterance.voice = this.maleVoice;
      utterance.pitch = 0.9;
    }

    utterance.onend = () => {
      this.currentIndex++;
      this.speakNextLine();
    };

    utterance.onerror = () => {
      this.currentIndex++;
      this.speakNextLine();
    };

    window.speechSynthesis.speak(utterance);
  }

  stop() {
    this.isPlaying = false;
    this.currentIndex = 0;
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (this.playIcon) this.playIcon.textContent = "▶";
    if (this.playLabel) this.playLabel.textContent = "Ouvir Podcast";
    if (this.waveform) this.waveform.classList.remove("playing");
  }
}

window.AudioPlayer = new AudioOverviewPlayer();
