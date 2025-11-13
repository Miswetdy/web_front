import React, { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../styles/YearStartPage.css';

type YearStartPageProps = {
  /** URL видео для заднего фона */
  videoSrc?: string;
  /** Изображение-заглушка при отключённом видео */
  poster?: string;
};

export default function YearStartPage({
  videoSrc = '/video.mp4',
  poster = '/video-poster.jpg',
}: YearStartPageProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute('autoplay');
      videoRef.current.loop = false;
    }
  }, []);

  return (
    <div className="year-hero-root">
      {/* Видео на весь экран */}
      <video
        ref={videoRef}
        className="year-hero-video"
        src={videoSrc}
        poster={poster}
        autoPlay
        muted
        loop
        playsInline
      />

      {/* Затемнение поверх видео */}
      <div className="year-hero-overlay"></div>

      {/* Контент по центру */}
      <div className="year-hero-center">
        <div className="year-hero-card">
          <h1 className="year-hero-title">Заказ вычисления года исторического события</h1>
          <Link to="/persons" className="year-hero-button">
            Перейти к списку услуг
          </Link>
        </div>
      </div>
    </div>
  );
}