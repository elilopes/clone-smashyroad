import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export interface NativePlatformInfo {
  isNative: boolean;
  platform: 'android' | 'ios' | 'web';
}

export function getNativePlatform(): NativePlatformInfo {
  return {
    isNative: Capacitor.isNativePlatform(),
    platform: Capacitor.getPlatform() as 'android' | 'ios' | 'web'
  };
}

export async function initCapacitorBridge(callbacks?: {
  onBackButtonPressed?: () => boolean; // return true if handled
}): Promise<void> {
  const { isNative, platform } = getNativePlatform();
  if (!isNative) {
    // Running in standard browser
    return;
  }

  // 1. Configurar barra de status imersiva
  try {
    if (Capacitor.isPluginAvailable('StatusBar')) {
      await StatusBar.setOverlaysWebView({ overlay: true });
      await StatusBar.setStyle({ style: Style.Dark });
      if (platform === 'android') {
        await StatusBar.setBackgroundColor({ color: '#111412' });
      }
    }
  } catch (err) {
    console.warn('[Capacitor] Erro ao configurar StatusBar:', err);
  }

  // 2. Ocultar splash screen com transição suave após carregamento inicial
  try {
    if (Capacitor.isPluginAvailable('SplashScreen')) {
      setTimeout(async () => {
        try {
          await SplashScreen.hide({ fadeOutDuration: 400 });
        } catch {}
      }, 500);
    }
  } catch (err) {
    console.warn('[Capacitor] Erro ao ocultar SplashScreen:', err);
  }

  // 3. Gerenciamento do botão Voltar nativo do Android (Hardware Back Button)
  try {
    if (Capacitor.isPluginAvailable('App')) {
      App.addListener('backButton', ({ canGoBack }) => {
        if (callbacks?.onBackButtonPressed) {
          const handled = callbacks.onBackButtonPressed();
          if (handled) return;
        }

        // Se houver modais abertos na tela, fechar o mais recente
        const activeModals = [
          '#settings-modal',
          '#shop-modal',
          '#leaderboard-modal',
          '#auth-modal'
        ];

        for (const selector of activeModals) {
          const el = document.querySelector<HTMLElement>(selector);
          if (el && !el.classList.contains('hidden')) {
            el.classList.add('hidden');
            return;
          }
        }

        // Se o jogo estiver pausado, despausar ou fechar overlay
        const pauseOverlay = document.querySelector<HTMLElement>('#pause-overlay');
        if (pauseOverlay && !pauseOverlay.classList.contains('hidden')) {
          const resumeBtn = document.querySelector<HTMLButtonElement>('#resume-button');
          if (resumeBtn) {
            resumeBtn.click();
            return;
          }
        }

        // Se puder voltar página ou minimizar o app
        if (canGoBack) {
          window.history.back();
        } else {
          App.minimizeApp();
        }
      });
    }
  } catch (err) {
    console.warn('[Capacitor] Erro ao configurar backButton do App:', err);
  }
}

/**
 * Gatilho de Vibração Tátil Nativa (Haptics)
 * Dispara vibrações hápticas imersivas no controle do jogador ao colidir ou usar turbo
 */
export async function triggerHapticImpact(style: 'light' | 'medium' | 'heavy' = 'medium'): Promise<void> {
  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Haptics')) {
    try {
      const styleMap = {
        light: ImpactStyle.Light,
        medium: ImpactStyle.Medium,
        heavy: ImpactStyle.Heavy
      };
      await Haptics.impact({ style: styleMap[style] });
      return;
    } catch {}
  }

  // Fallback suave usando navigator.vibrate para navegadores móveis web
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      const duration = style === 'heavy' ? 40 : style === 'medium' ? 22 : 12;
      navigator.vibrate(duration);
    } catch {}
  }
}

/**
 * Vibração de Notificação de Sucesso ou Alerta (Haptics)
 */
export async function triggerHapticNotification(type: 'success' | 'warning' | 'error' = 'success'): Promise<void> {
  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Haptics')) {
    try {
      const typeMap = {
        success: NotificationType.Success,
        warning: NotificationType.Warning,
        error: NotificationType.Error
      };
      await Haptics.notification({ type: typeMap[type] });
      return;
    } catch {}
  }

  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(type === 'success' ? [15, 40, 25] : [30, 50, 40]);
    } catch {}
  }
}
