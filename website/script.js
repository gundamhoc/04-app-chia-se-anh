// Masita Landing Page Interactive Scripts

document.addEventListener('DOMContentLoaded', () => {
  // 1. Interactive Phone Mockup Tabs (Real App Screenshots)
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

  // 2. Generic Modal Manager (QR, Changelog, Support, Terms, Privacy)
  const openModal = (modalId) => {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden'; // prevent background scrolling
    }
  };

  const closeModal = (modal) => {
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  };

  // Triggers
  document.getElementById('btn-show-qr')?.addEventListener('click', () => openModal('qr-modal'));
  document.getElementById('btn-changelog')?.addEventListener('click', () => openModal('changelog-modal'));
  document.getElementById('btn-support')?.addEventListener('click', () => openModal('support-modal'));
  document.getElementById('btn-terms')?.addEventListener('click', () => openModal('terms-modal'));
  document.getElementById('btn-privacy')?.addEventListener('click', () => openModal('privacy-modal'));

  // Close buttons with data-close
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-close');
      const targetModal = document.getElementById(modalId);
      closeModal(targetModal);
    });
  });

  // Modal default close button (#modal-close-btn for QR)
  document.getElementById('modal-close-btn')?.addEventListener('click', () => {
    closeModal(document.getElementById('qr-modal'));
  });

  // Close when clicking overlay backdrop
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal(overlay);
      }
    });
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(modal => closeModal(modal));
    }
  });

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
      
      const rotateX = (-y / rect.height) * 12;
      const rotateY = (x / rect.width) * 12;
      
      phoneFrame.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px)`;
    });

    heroMockupWrap.addEventListener('mouseleave', () => {
      phoneFrame.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0)';
    });
  }
});
