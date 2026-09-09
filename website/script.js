// Masita Landing Page Interactive Scripts

document.addEventListener('DOMContentLoaded', () => {
  // 1. Interactive Phone Mockup Tabs
  const tabs = document.querySelectorAll('.screen-tab');
  const views = document.querySelectorAll('.app-view');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active from all tabs
      tabs.forEach(t => t.classList.remove('active'));
      // Add active to clicked tab
      tab.classList.add('active');

      const targetId = tab.getAttribute('data-target');
      
      // Switch view with smooth transition
      views.forEach(view => {
        if (view.id === targetId) {
          view.classList.add('active');
        } else {
          view.classList.remove('active');
        }
      });
    });
  });

  // 2. QR Code Modal Popup
  const showQrBtn = document.getElementById('btn-show-qr');
  const qrModal = document.getElementById('qr-modal');
  const closeQrBtn = document.getElementById('modal-close-btn');

  if (showQrBtn && qrModal) {
    showQrBtn.addEventListener('click', () => {
      qrModal.classList.add('active');
    });

    closeQrBtn?.addEventListener('click', () => {
      qrModal.classList.remove('active');
    });

    // Close when clicking outside the box
    qrModal.addEventListener('click', (e) => {
      if (e.target === qrModal) {
        qrModal.classList.remove('active');
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && qrModal.classList.contains('active')) {
        qrModal.classList.remove('active');
      }
    });
  }

  // 3. Copy APK Download Link
  const copyBtn = document.getElementById('btn-copy-link');
  const copyText = document.getElementById('copy-text');
  const downloadUrl = 'https://expo.dev/accounts/gundamhoc/projects/masita/builds/71a7907f-ce43-4050-bcd3-e1161ca5b7c9';

  if (copyBtn && copyText) {
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(downloadUrl);
        const originalText = copyText.textContent;
        copyText.textContent = 'Đã sao chép link! ✓';
        copyBtn.style.borderColor = 'var(--success)';
        copyBtn.style.color = 'var(--success)';

        setTimeout(() => {
          copyText.textContent = originalText;
          copyBtn.style.borderColor = '';
          copyBtn.style.color = '';
        }, 3000);
      } catch (err) {
        window.prompt('Sao chép đường dẫn tải:', downloadUrl);
      }
    });
  }

  // 4. Parallax Effect for Phone Mockup on Mouse Move (Desktop)
  const phoneFrame = document.querySelector('.phone-frame');
  const heroMockupWrap = document.querySelector('.hero-mockup-wrap');

  if (phoneFrame && heroMockupWrap && window.innerWidth > 992) {
    heroMockupWrap.addEventListener('mousemove', (e) => {
      const rect = heroMockupWrap.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      
      const rotateX = (-y / rect.height) * 14;
      const rotateY = (x / rect.width) * 14;
      
      phoneFrame.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px)`;
    });

    heroMockupWrap.addEventListener('mouseleave', () => {
      phoneFrame.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0)';
    });
  }
});
