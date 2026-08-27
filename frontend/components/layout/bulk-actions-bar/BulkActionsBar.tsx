import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { animate } from 'animejs';
import { gsap } from 'gsap';
import {
  X, FolderMinus, Trash2, Heart,
  RotateCcw, LayoutGrid, BookOpen, ClipboardPaste,
} from 'lucide-react';
import { ViewMode } from '@/types';
import { useBulkActions } from './useBulkActions';
import { useEditStore } from '@/store/editStore';
import { soundEffects } from '@/utils/soundEffects';
import { spawnRadialHeartBurst, spawnUnfavoriteBurst, pulseElement } from './heartAnimations';
import { customConfirm } from '@/services/ConfirmService';
import { ActionButton } from './ActionButton';
import { CssTrashIcon, CssFolderIcon, CssVaultIcon } from './BulkActionIcons';
import { nextFrame, delay, flyToTrash, spawnParticles, gulpBounce } from './animationHelpers';
import './BulkActionsBar.css';

// ─── Component props ─────────────────────────────────────────────────────
export interface BulkActionsBarProps {
  selectedCount: number;
  currentView: ViewMode;
  onClear: () => void;
  onAddToAlbum: () => void;
  albumAddedSignal?: number;
  onRemoveFromAlbum?: () => void;
  onToggleLock: () => void;
  onFavorite: () => void;
  onDelete: (skipConfirm?: boolean) => void;
  onRestore?: () => void;
  onCollage?: () => void;
  onPhotoBook?: () => void;
  onToolbox?: () => void;
  isFavorited?: boolean;
  onPasteEdits?: () => void;
}

// ─── BulkActionsBar ──────────────────────────────────────────────────────
/**
 * BulkActionsBar - Renders bulk actions bar.
 */
export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  selectedCount,
  currentView,
  onClear,
  onAddToAlbum,
  albumAddedSignal,
  onRemoveFromAlbum,
  onToggleLock,
  onFavorite,
  onDelete,
  onRestore,
  onCollage,
  onPhotoBook,
  onToolbox,
  isFavorited,
  onPasteEdits,
}) => {
  const { isTrashView } = useBulkActions({ selectedCount, currentView });
  /**
   * copiedAdjustments - Performs copied adjustments.
   */
  const copiedAdjustments = useEditStore((s) => s.copiedAdjustments);

  const barRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const prevCount = useRef(selectedCount);
  const [open, setOpen] = useState(selectedCount > 0);
  const [session, setSession] = useState(0);

  // ── Trash, Album & Lock animation refs & state ────────────────────────────
  const trashBtnRef = useRef<HTMLDivElement>(null);
  const albumBtnRef = useRef<HTMLDivElement>(null);
  const lockBtnRef = useRef<HTMLDivElement>(null);
  const favBtnRef = useRef<HTMLDivElement>(null);

  const trashPopupRef = useRef<HTMLDivElement>(null);
  const trashOverlayRef = useRef<HTMLDivElement>(null);
  const trashBadgeRef = useRef<HTMLDivElement>(null);
  const trashInnerRef = useRef<HTMLDivElement>(null);
  const [trashAnimating, setTrashAnimating] = useState(false);

  const folderPopupRef = useRef<HTMLDivElement>(null);
  const folderInnerRef = useRef<HTMLDivElement>(null);
  const [folderAnimating, setFolderAnimating] = useState(false);

  const lockPopupRef = useRef<HTMLDivElement>(null);
  const lockInnerRef = useRef<HTMLDivElement>(null);
  const [lockAnimating, setLockAnimating] = useState(false);

  // ── Favorite micro-interaction ──────────────────────────────────────────
  /**
   * animateFavorite - Performs animate favorite.
   */
  const animateFavorite = useCallback(() => {
    const favWrap = favBtnRef.current;
    if (favWrap) {
      pulseElement(favWrap, 1.2, 200);
    }

    soundEffects.play(isFavorited ? 'click' : 'favorite');

    const selectedCards = Array.from(
      document.querySelectorAll<HTMLElement>(
        '.photo-item-selected, [aria-pressed="true"].group, [aria-pressed="true"]',
      ),
    );

    if (selectedCards.length > 0) {
      selectedCards.forEach((card) => {
        const rect = card.getBoundingClientRect();
        if (rect.width > 0) {
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          if (isFavorited) {
            spawnUnfavoriteBurst(centerX, centerY);
          } else {
            spawnRadialHeartBurst(centerX, centerY);
          }
        }
      });
    }

    onFavorite();
    onClear();
  }, [isFavorited, onFavorite, onClear]);

  // Enter: rise + fade + scale, shadow blooms, divider grows
  /**
   * playEnter - Performs play enter.
   */
  const playEnter = useCallback(() => {
    const el = barRef.current;
    if (el) {
      animate(el, {
        opacity: [0, 1],
        y: [16, 0],
        scale: [0.96, 1],
        boxShadow: ['0px 8px 8px rgba(0,0,0,0.05)', '0px 8px 24px rgba(0,0,0,0.2)'],
        duration: 220,
        ease: 'outCubic',
      });
    }
    const div = dividerRef.current;
    if (div) {
      div.style.transformOrigin = 'top center';
      div.style.transform = 'scaleY(0)';
      animate(div, { scaleY: [0, 1], opacity: [0, 0.4], duration: 220, ease: 'outCubic', delay: 40 });
    }
  }, []);

  // Exit: quick drop + fade
  /**
   * playExit - Performs play exit.
   */
  const playExit = useCallback((done: () => void) => {
    const el = barRef.current;
    if (!el) { done(); return; }
    animate(el, {
      opacity: [1, 0],
      y: [0, 8],
      scale: [1, 0.98],
      duration: 160,
      ease: 'outCubic',
      onComplete: done,
    });
  }, []);

  // Close button: exit, then close once the fade finishes
  /**
   * handleClose - Handles close.
   */
  const handleClose = useCallback(() => {
    playExit(() => setOpen(false));
    onClear();
  }, [playExit, onClear]);

  // ── Folder animation sequence for Add to Album ─────────────────────────
  /**
   * animateAddToAlbum - Performs animate add to album.
   */
  const animateAddToAlbum = useCallback(async () => {
    if (folderAnimating || selectedCount === 0) return;
    setFolderAnimating(true);

    const btnWrap = albumBtnRef.current;
    const popup = folderPopupRef.current;
    const overlay = trashOverlayRef.current;
    const inner = folderInnerRef.current;
    if (!btnWrap || !popup || !overlay) {
      setFolderAnimating(false);
      return;
    }

    // 1. Block interaction overlay
    overlay.classList.add('active');

    // 2. Position animated folder at the Album button center
    const btnRect = btnWrap.getBoundingClientRect();
    const centerX = btnRect.left + btnRect.width / 2;
    const centerY = btnRect.top + btnRect.height / 2;

    popup.style.left = `${centerX}px`;
    popup.style.top = `${centerY}px`;
    popup.style.display = 'flex';

    // 3. Popup from button (GSAP scale + y rise)
    soundEffects.play('popup');
    popup.className = 'folder-animated folder-css folder-anim-popup';

    gsap.fromTo(
      popup,
      { scale: 0.8, opacity: 0, y: 0 },
      { scale: 2.6, opacity: 1, y: -50, duration: 0.22, ease: 'power2.out' },
    );
    await delay(220);

    // 4. Open 3D folder flap
    popup.classList.add('folder-anim-open');
    await delay(140);

    // 5. Query selected photo cards
    const selectedCards = Array.from(
      document.querySelectorAll<HTMLElement>(
        '.photo-item-selected, [aria-pressed="true"].group, [aria-pressed="true"]',
      ),
    );

    const folderRect = popup.getBoundingClientRect();
    const targetX = folderRect.left + folderRect.width / 2;
    const targetY = folderRect.top + folderRect.height * 0.35;
    const clones: HTMLElement[] = [];
    const originals: HTMLElement[] = [];

    if (selectedCards.length > 0) {
      selectedCards.forEach((card, i) => {
        setTimeout(() => {
          const rect = card.getBoundingClientRect();
          if (rect.width === 0) return; // off-screen, skip

          const imgEl = card.querySelector<HTMLImageElement>('img');
          const imgSrc = imgEl?.src || '';

          const clone = document.createElement('div');
          clone.className = 'trash-fly-clone';
          clone.style.left = `${rect.left}px`;
          clone.style.top = `${rect.top}px`;
          clone.style.width = `${rect.width}px`;
          clone.style.height = `${rect.height}px`;
          clone.innerHTML = imgSrc
            ? `<img src="${imgSrc}" class="w-full h-full object-cover rounded-xl shadow-2xl">`
            : card.innerHTML;

          document.body.appendChild(clone);
          clones.push(clone);
          originals.push(card);
          card.classList.add('trash-fly-hidden');

          // Target offset for 2x2 grid stack inside the folder!
          const col = (i % 4) >= 2 ? 1 : 0; // 0 = left slot, 1 = right slot
          const row = i % 2; // 0 = top slot, 1 = bottom slot
          const slotOffsetX = (col - 0.5) * 28;
          const slotOffsetY = (row - 0.5) * 20;

          flyToTrash(clone, targetX + slotOffsetX, targetY + slotOffsetY, {
            duration: 400,
            onComplete: () => {
              soundEffects.play('suck');
              spawnParticles(targetX + slotOffsetX, targetY + slotOffsetY, 8);
              if (inner) {
                gsap.to(inner, {
                  scaleX: 1.15,
                  scaleY: 0.9,
                  duration: 0.1,
                  yoyo: true,
                  repeat: 1,
                  ease: 'power2.out',
                });
              }
            },
          });
        }, i * 65);
      });

      await delay(420 + selectedCards.length * 65);
    } else {
      spawnParticles(targetX, targetY, 10);
      await delay(200);
    }

    // 6. Cleanup clones
    clones.forEach((c) => c.remove());
    originals.forEach((o) => o.classList.remove('trash-fly-hidden'));

    // 7. Close 3D folder flap
    soundEffects.play('click');
    popup.classList.remove('folder-anim-open');
    popup.classList.add('folder-anim-close');
    await delay(140);

    // 8. Return down into button
    soundEffects.play('return');
    gsap.to(popup, {
      scale: 1,
      opacity: 0,
      y: 0,
      duration: 0.22,
      ease: 'power2.in',
      onComplete: () => {
        popup.style.display = 'none';
        popup.className = 'folder-animated folder-css';
        overlay.classList.remove('active');
        setFolderAnimating(false);
        onClear();
      },
    });
  }, [folderAnimating, selectedCount, onClear]);

  useEffect(() => {
    if (albumAddedSignal && albumAddedSignal > 0) {
      animateAddToAlbum();
    }
  }, [albumAddedSignal, animateAddToAlbum]);

  // ── Lock / Encrypt animation sequence (3D Armored Vault Door) ────────────
  /**
   * animateLock - Performs animate lock.
   */
  const animateLock = useCallback(async () => {
    if (lockAnimating || selectedCount === 0) return;
    setLockAnimating(true);

    const btnWrap = lockBtnRef.current;
    const popup = lockPopupRef.current;
    const overlay = trashOverlayRef.current;
    const inner = lockInnerRef.current;
    if (!btnWrap || !popup || !overlay) {
      setLockAnimating(false);
      onToggleLock();
      onClear();
      return;
    }

    // 1. Block interaction overlay
    overlay.classList.add('active');

    // 2. Position animated vault at the Lock button center
    const btnRect = btnWrap.getBoundingClientRect();
    const centerX = btnRect.left + btnRect.width / 2;
    const centerY = btnRect.top + btnRect.height / 2;

    popup.style.left = `${centerX}px`;
    popup.style.top = `${centerY}px`;
    popup.style.transform = 'translate(-50%, -50%)';
    popup.style.display = 'flex';

    // 3. Popup from button (GSAP scale + y rise)
    soundEffects.play('popup');
    popup.className = 'vault-animated vault-css vault-anim-popup';

    gsap.fromTo(
      popup,
      { scale: 1, opacity: 0, y: 0, xPercent: -50, yPercent: -50 },
      { scale: 2.8, opacity: 1, y: -110, xPercent: -50, yPercent: -50, duration: 0.25, ease: 'power2.out' },
    );
    await delay(250);

    // 4. Spin chrome wheel & 3D swing vault door open 110°
    soundEffects.play('click');
    popup.classList.add('vault-anim-open');
    await delay(200);

    // 5. Query selected photo cards & fly them into open vault safe
    const selectedCards = Array.from(
      document.querySelectorAll<HTMLElement>(
        '.photo-item-selected, [aria-pressed="true"].group, [aria-pressed="true"]',
      ),
    );

    const targetX = centerX;
    const targetY = centerY - 110;
    const clones: HTMLElement[] = [];
    const originals: HTMLElement[] = [];

    if (selectedCards.length > 0) {
      selectedCards.forEach((card, i) => {
        setTimeout(() => {
          const rect = card.getBoundingClientRect();
          if (rect.width === 0) return; // off-screen, skip

          const imgEl = card.querySelector<HTMLImageElement>('img');
          const imgSrc = imgEl?.src || '';

          const clone = document.createElement('div');
          clone.className = 'trash-fly-clone';
          clone.style.left = `${rect.left}px`;
          clone.style.top = `${rect.top}px`;
          clone.style.width = `${rect.width}px`;
          clone.style.height = `${rect.height}px`;
          clone.innerHTML = imgSrc
            ? `<img src="${imgSrc}" class="w-full h-full object-cover rounded-xl shadow-2xl border-2 border-slate-200/90">`
            : card.innerHTML;

          document.body.appendChild(clone);
          clones.push(clone);
          originals.push(card);
          card.classList.add('trash-fly-hidden');

          flyToTrash(clone, targetX, targetY, {
            duration: 380,
            onComplete: () => {
              clone.remove();
              soundEffects.play('suck');
              spawnParticles(targetX, targetY, 8);
              if (inner) {
                gsap.to(inner, {
                  scaleX: 1.12,
                  scaleY: 0.92,
                  duration: 0.08,
                  yoyo: true,
                  repeat: 1,
                  ease: 'power2.out',
                });
              }
            },
          });
        }, i * 65);
      });

      // Wait for all flights to land inside vault
      await delay(400 + selectedCards.length * 65);
    } else {
      spawnParticles(targetX, targetY, 10);
      await delay(200);
    }

    // 6. Heavy vault door slams shut cleanly (no overshoot)
    soundEffects.play('slam');
    popup.classList.remove('vault-anim-open');
    popup.classList.add('vault-anim-snap');

    if (inner) {
      gsap.to(inner, {
        scale: 1.18,
        duration: 0.1,
        yoyo: true,
        repeat: 1,
        ease: 'power2.out',
      });
    }

    // Wait for 3D door swing to finish
    await delay(320);

    // 7. Return down into button, execute onToggleLock and clear selection
    soundEffects.play('return');
    gsap.to(popup, {
      scale: 1,
      opacity: 0,
      y: 0,
      xPercent: -50,
      yPercent: -50,
      duration: 0.22,
      ease: 'power2.in',
      onComplete: () => {
        clones.forEach((c) => c.remove());
        popup.style.display = 'none';
        popup.className = 'vault-animated vault-css';
        overlay.classList.remove('active');
        setLockAnimating(false);
        onToggleLock();
        onClear();
      },
    });
  }, [lockAnimating, selectedCount, onToggleLock, onClear]);

  // ── Trash animation sequence ───────────────────────────────────────────
  /**
   * animateTrash - Performs animate trash.
   */
  const animateTrash = useCallback(async () => {
    if (trashAnimating || selectedCount === 0) return;
    setTrashAnimating(true);

    const btnWrap = trashBtnRef.current;
    const popup = trashPopupRef.current;
    const overlay = trashOverlayRef.current;
    const inner = trashInnerRef.current;
    if (!btnWrap || !popup || !overlay) {
      setTrashAnimating(false);
      onDelete(true);
      return;
    }

    // 1. Block interaction
    overlay.classList.add('active');

    // 2. Position animated trash at the trash button center
    const btnRect = btnWrap.getBoundingClientRect();
    popup.style.left = `${btnRect.left + btnRect.width / 2}px`;
    popup.style.top = `${btnRect.top + btnRect.height / 2}px`;
    popup.style.display = 'flex';

    // 3. Popup from button (CSS keyframe)
    soundEffects.play('popup');
    popup.className = 'trash-animated trash-css trash-anim-popup';
    await delay(220);

    // 4. Open lid (CSS transition)
    popup.classList.add('trash-anim-open');
    await delay(140);

    // 5. Find selected cards in the gallery (supports grid, list, and custom card views)
    const selectedCards = Array.from(
      document.querySelectorAll<HTMLElement>(
        '.photo-item-selected, [aria-pressed="true"].group, [aria-pressed="true"]',
      ),
    );

    // 7. Clone each card and fly it to the trash can
    const trashRect = popup.getBoundingClientRect();
    const targetX = trashRect.left + trashRect.width / 2;
    const targetY = trashRect.top + trashRect.height * 0.25;
    const clones: HTMLElement[] = [];
    const originals: HTMLElement[] = [];

    if (selectedCards.length > 0) {
      selectedCards.forEach((card, i) => {
        setTimeout(() => {
          const rect = card.getBoundingClientRect();
          if (rect.width === 0) return; // off-screen, skip

          const imgEl = card.querySelector<HTMLImageElement>('img');
          const imgSrc = imgEl?.src || '';

          const clone = document.createElement('div');
          clone.className = 'trash-fly-clone';
          clone.style.left = `${rect.left}px`;
          clone.style.top = `${rect.top}px`;
          clone.style.width = `${rect.width}px`;
          clone.style.height = `${rect.height}px`;
          clone.innerHTML = imgSrc
            ? `<img src="${imgSrc}" class="w-full h-full object-cover rounded-xl shadow-2xl">`
            : card.innerHTML;

          document.body.appendChild(clone);
          clones.push(clone);
          originals.push(card);
          card.classList.add('trash-fly-hidden');

          flyToTrash(clone, targetX, targetY, {
            duration: 380,
            onComplete: () => {
              soundEffects.play('suck');
              soundEffects.play('gulp');
              spawnParticles(targetX, targetY, 12);
              gulpBounce(inner);
            },
          });
        }, i * 70);
      });

      // 8. Wait for all flights to land
      await delay(450 + selectedCards.length * 70);
    } else {
      // If selected cards are off-screen, pulse trash directly
      gulpBounce(inner);
      spawnParticles(targetX, targetY, 12);
      await delay(200);
    }

    // 9. Cleanup clones
    clones.forEach((c) => c.remove());
    originals.forEach((o) => o.classList.remove('trash-fly-hidden'));

    // 10. Close lid
    soundEffects.play('slam');
    popup.classList.remove('trash-anim-open');
    popup.classList.add('trash-anim-close');
    await delay(140);

    // 11. Shake
    popup.classList.remove('trash-anim-close');
    popup.classList.add('trash-anim-shake');
    await delay(200);

    // 12. Return to button (CSS keyframe)
    soundEffects.play('return');
    popup.classList.remove('trash-anim-popup', 'trash-anim-shake');
    popup.classList.add('trash-anim-return');
    overlay.classList.remove('active');
    await delay(250);

    // 13. Hide popup, reset
    popup.style.display = 'none';
    popup.className = 'trash-animated trash-css';
    setTrashAnimating(false);

    // 14. Fire the actual delete with skipConfirm = true and clear selection
    onDelete(true);
    onClear();
  }, [trashAnimating, selectedCount, onDelete, onClear]);

  /**
   * handleTrashClick - Handles trash click.
   */
  const handleTrashClick = useCallback(async () => {
    if (trashAnimating || selectedCount === 0) return;

    if (isTrashView) {
      onDelete();
      return;
    }

    // Show confirming card IMMEDIATELY (0ms delay!)
    const isPermanent = currentView === 'trash';
    const message = isPermanent
      ? `Permanently delete ${selectedCount} items from Trash?`
      : `Move ${selectedCount} items to Trash?`;

    const confirmed = await customConfirm(message, 'Confirm Deletion');
    if (!confirmed) return;

    // Confirmed! Run snappy trash animation
    await animateTrash();
  }, [trashAnimating, selectedCount, isTrashView, currentView, animateTrash, onDelete]);

  // Visibility + count roll
  useEffect(() => {
    const prev = prevCount.current;
    prevCount.current = selectedCount;

    if (prev === 0 && selectedCount > 0) {
      setSession((s) => s + 1);
      setOpen(true);
    } else if (selectedCount === 0 && open) {
      playExit(() => setOpen(false));
    }

    if (open && selectedCount > 0 && prev !== selectedCount) {
      const el = countRef.current;
      if (el) animate(el, { y: [8, 0], opacity: [0, 1], duration: 180, ease: 'outCubic' });
    }
  }, [selectedCount, open, playExit]);

  // Run enter animation once mounted
  useEffect(() => {
    if (open) nextFrame(() => playEnter());
  }, [open, session, playEnter]);

  if (!open) return null;

  return (
    <div className="absolute bottom-24 left-1/2 z-30 -translate-x-1/2">
      <div
        key={session}
        ref={barRef}
        className="bg-surface/90 backdrop-blur-xl rounded-full px-4 py-2.5 flex items-center gap-3"
        style={{ opacity: 0, transform: 'translateY(16px) scale(0.96)', boxShadow: '0px 8px 8px rgba(0,0,0,0.05)' }}
      >
        {/* ── Left: clear + count ────────────────────────────────────── */}
        <div className="flex items-center gap-2.5 pr-3 border-r border-border/30 select-none">
          <button
            onClick={handleClose}
            className="p-1 hover:bg-surfaceHover rounded-full transition-colors flex-shrink-0"
            title="Clear selection"
          >
            <X size={18} className="text-gray-400" />
          </button>
          <span ref={countRef} className="font-bold text-gray-100 text-sm whitespace-nowrap">
            {selectedCount} selected
          </span>
        </div>

        {/* ── Right: action icons ──────────────────────────────────── */}
        <div className="flex items-center gap-1.5">
          {isTrashView ? (
            <>
              <ActionButton onClick={() => { onRestore?.(); onClear(); }} label="Restore" className="hover:text-green-400">
                <RotateCcw size={20} />
              </ActionButton>
              <ActionButton onClick={() => { onDelete(false); onClear(); }} label="Delete Permanently" className="hover:text-red-400" hoverRotate>
                <Trash2 size={20} />
              </ActionButton>
            </>
          ) : (
            <>
              {/* Productive actions */}
              <div ref={favBtnRef}>
                <ActionButton
                  onClick={animateFavorite}
                  label={isFavorited ? 'Unfavorite' : 'Favorite'}
                  className={isFavorited ? 'text-rose-400 hover:text-rose-300' : 'hover:text-rose-400'}
                  pulseOnClick
                >
                  <Heart size={20} className={isFavorited ? 'fill-rose-400' : ''} />
                </ActionButton>
              </div>

              {currentView === 'albums' && onRemoveFromAlbum && (
                <ActionButton onClick={() => { onRemoveFromAlbum(); onClear(); }} label="Remove from Album" className="hover:text-red-400" hoverRotate>
                  <FolderMinus size={20} />
                </ActionButton>
              )}

              <div ref={albumBtnRef}>
                <ActionButton
                  onClick={folderAnimating ? undefined : onAddToAlbum}
                  label="Album"
                  className={folderAnimating ? 'opacity-0 pointer-events-none' : ''}
                >
                  <CssFolderIcon />
                </ActionButton>
              </div>

              {onToolbox && (
                <ActionButton onClick={onToolbox} label="Toolbox" className="hover:text-primary">
                  <img src="/toolbox.svg" alt="Toolbox" className="w-5 h-5 object-contain filter invert brightness-125" />
                </ActionButton>
              )}

              {copiedAdjustments && onPasteEdits && (
                <ActionButton onClick={() => { onPasteEdits(); onClear(); }} label="Paste Edits" className="hover:text-primary">
                  <ClipboardPaste size={20} />
                </ActionButton>
              )}

              {/* State-changing actions */}
              <div ref={dividerRef} className="w-px h-7 bg-border/30 mx-1 origin-top" />

              <div ref={lockBtnRef} className={lockAnimating ? 'opacity-0 pointer-events-none' : ''}>
                <ActionButton
                  onClick={lockAnimating ? undefined : (currentView === 'locked' ? () => { onToggleLock(); onClear(); } : animateLock)}
                  label={currentView === 'locked' ? 'Unlock' : 'Lock'}
                  className={currentView === 'locked' ? 'text-primary' : 'hover:text-primary'}
                  lockSnap
                >
                  <CssVaultIcon />
                </ActionButton>
              </div>

              {/* ── Trash button with fly-to-trash animation ──────── */}
              <div ref={trashBtnRef}>
                <ActionButton
                  onClick={trashAnimating ? undefined : handleTrashClick}
                  label="Trash"
                  className={`text-red-400 hover:text-red-300 ${trashAnimating ? 'opacity-0 pointer-events-none' : ''}`}
                  labelClassName={`text-red-400 ${trashAnimating ? 'opacity-0 pointer-events-none' : ''}`}
                  hoverRotate
                >
                  <CssTrashIcon />
                </ActionButton>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Overlay & Animated CSS elements (Portaled directly to document.body) ── */}
      {createPortal(
        <>
          <div ref={trashOverlayRef} className="trash-anim-overlay" />

          {/* Animated CSS trash can */}
          <div ref={trashPopupRef} className="trash-animated trash-css" style={{ display: 'none' }}>
            <div ref={trashInnerRef} className="trash-animated-inner">
              <div className="trash-css-lid">
                <div className="trash-css-handle" />
                <div className="trash-css-bar" />
              </div>
              <div className="trash-css-body">
                <div className="trash-css-strip" />
                <div className="trash-css-strip" />
              </div>
            </div>
          </div>

          {/* Animated 3D Folder for Add to Album */}
          <div ref={folderPopupRef} className="folder-animated folder-css" style={{ display: 'none' }}>
            <div ref={folderInnerRef} className="folder-animated-inner flex flex-col items-center">
              <div className="folder-css-back" />
              <div className="folder-css-tab" />
              <div className="folder-css-paper">
                <div className="folder-css-slot" />
                <div className="folder-css-slot" />
                <div className="folder-css-slot" />
                <div className="folder-css-slot" />
              </div>
              <div className="folder-css-front" />
            </div>
          </div>

          {/* Animated Vault Popup for Lock / Encrypt */}
          <div ref={lockPopupRef} className="vault-animated" style={{ display: 'none' }}>
            <div ref={lockInnerRef} className="vault-animated-inner flex flex-col items-center">
              <CssVaultIcon className="w-16 h-16" />
            </div>
          </div>
        </>,
        document.body,
      )}
    </div>
  );
};
