// Áudio Reverso — gravação, inversão e reprodução de áudio no próprio navegador (sem servidor).
// Grava PCM cru pelo Web Audio (funciona no iPhone e no Android), corta o silêncio das pontas e normaliza o volume.
(function (global) {
  const A = {};
  A.MAX_SEG = 12;
  let ctx = null, tocando = null;

  A.suportado = () => !!(global.navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && (global.AudioContext || global.webkitAudioContext));
  A.ctx = () => {
    if (!ctx) ctx = new (global.AudioContext || global.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };

  // Começa a gravar. Devolve { parar(): Promise<AudioBuffer|null>, nivel(): 0..1, segundos() }
  A.gravar = async (onAuto) => {
    const c = A.ctx();
    A.parar();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true } });
    const src = c.createMediaStreamSource(stream);
    const proc = c.createScriptProcessor(4096, 1, 1);
    const mudo = c.createGain(); mudo.gain.value = 0;
    const partes = []; let nivel = 0, total = 0, fim = false;
    const ini = Date.now();
    proc.onaudioprocess = e => {
      if (fim) return;
      const d = e.inputBuffer.getChannelData(0);
      partes.push(new Float32Array(d)); total += d.length;
      let m = 0; for (let i = 0; i < d.length; i += 8) { const v = Math.abs(d[i]); if (v > m) m = v; }
      nivel = nivel * 0.6 + m * 0.4;
      if (total / c.sampleRate >= A.MAX_SEG && onAuto) { const f = onAuto; onAuto = null; setTimeout(f, 0); }
    };
    src.connect(proc); proc.connect(mudo); mudo.connect(c.destination);
    const parar = async () => {
      if (fim) return null;
      await new Promise(r => setTimeout(r, 350)); // recebe o que ainda está no buffer do microfone
      fim = true;
      try { src.disconnect(); proc.disconnect(); mudo.disconnect(); } catch (e) {}
      stream.getTracks().forEach(t => t.stop());
      if (!total) return null;
      const dados = new Float32Array(total); let o = 0;
      partes.forEach(p => { dados.set(p, o); o += p.length; });
      return montar(aparar(dados, c.sampleRate), c.sampleRate);
    };
    return { parar, nivel: () => Math.min(1, nivel * 2.5), segundos: () => (Date.now() - ini) / 1000 };
  };

  // tira o silêncio do começo e do fim (deixa uma folguinha) e normaliza o volume
  // Tira só o silêncio "de verdade" das pontas, com folga grande, para nunca cortar a fala.
  // O limite de silêncio é medido pelo ruído de fundo da própria gravação (não pelo pico),
  // assim sílabas finais mais fracas (s, x, f, "mos"...) não são confundidas com silêncio.
  function aparar(d, sr) {
    const jan = Math.max(1, Math.floor(sr * 0.02));
    const nj = Math.ceil(d.length / jan), rms = new Float32Array(nj);
    let pico = 0;
    for (let w = 0; w < nj; w++) {
      let t = 0; const ini = w * jan, fim = Math.min(d.length, ini + jan);
      for (let i = ini; i < fim; i++) { t += d[i] * d[i]; const v = Math.abs(d[i]); if (v > pico) pico = v; }
      rms[w] = Math.sqrt(t / Math.max(1, fim - ini));
    }
    if (pico < 0.003) return d.slice();
    const ord = Array.from(rms).sort((x, y) => x - y);
    const ruido = ord[Math.floor(ord.length * 0.1)] || 0;
    const topo = ord[ord.length - 1] || 0;
    const lim = Math.max(ruido * 3, topo * 0.02, 0.002);
    let wa = 0; while (wa < nj && rms[wa] < lim) wa++;
    let wb = nj - 1; while (wb > wa && rms[wb] < lim) wb--;
    let a = wa * jan - Math.floor(sr * 0.3);          // 0,3 s antes da fala
    let b = (wb + 1) * jan + Math.floor(sr * 0.6);    // 0,6 s depois da fala
    a = Math.max(0, a); b = Math.min(d.length, b);
    if (b - a < sr * 0.3) { a = 0; b = d.length; }
    const out = d.slice(a, b);
    const g = Math.min(8, 0.9 / pico);
    for (let i = 0; i < out.length; i++) out[i] *= g;
    // fade de 5 ms nas pontas (só no silêncio da folga) para não estalar
    const f = Math.min(Math.floor(sr * 0.005), out.length >> 1);
    for (let i = 0; i < f; i++) { const k = i / f; out[i] *= k; out[out.length - 1 - i] *= k; }
    return out;
  }
  function montar(dados, sr) {
    const buf = A.ctx().createBuffer(1, dados.length, sr);
    buf.getChannelData(0).set(dados);
    return buf;
  }

  A.inverter = buf => {
    if (!buf) return null;
    const d = buf.getChannelData(0), r = new Float32Array(d.length);
    for (let i = 0, n = d.length; i < n; i++) r[i] = d[n - 1 - i];
    return montar(r, buf.sampleRate);
  };
  A.duracao = buf => buf ? buf.duration : 0;

  // toca um buffer; onFim é chamado quando acaba (ou quando outro áudio começa)
  A.tocar = (buf, onFim) => {
    A.parar();
    if (!buf) return;
    const c = A.ctx();
    const s = c.createBufferSource(); s.buffer = buf; s.connect(c.destination);
    const reg = { s, onFim };
    s.onended = () => { if (tocando === reg) { tocando = null; if (onFim) onFim(); } };
    tocando = reg; s.start();
  };
  A.parar = () => {
    const t = tocando; tocando = null;
    if (t) { try { t.s.stop(); } catch (e) {} if (t.onFim) t.onFim(); }
  };
  A.tocandoAgora = () => !!tocando;

  global.Reverso = global.Reverso || {};
  global.Reverso.Audio = A;
})(window);
