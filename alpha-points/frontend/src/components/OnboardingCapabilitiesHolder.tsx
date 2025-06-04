import React, { useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, A11y } from 'swiper/modules';
// @ts-ignore
import 'swiper/css';
// @ts-ignore
import 'swiper/css/navigation';
// @ts-ignore
import 'swiper/css/pagination';

const ChevronLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
  </svg>
);
const ChevronRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

interface OnboardingCapabilitiesHolderProps {
  cards: React.ReactNode[];
}

export const OnboardingCapabilitiesHolder: React.FC<OnboardingCapabilitiesHolderProps> = ({ cards }) => {
  const [swiperInstance, setSwiperInstance] = useState<any>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className="bg-background-card rounded-lg shadow-lg p-4 flex flex-col h-full">
      <div className="flex flex-col h-full">
        <Swiper
          modules={[Navigation, Pagination, A11y]}
          spaceBetween={20}
          slidesPerView={1}
          loop={false}
          onSwiper={setSwiperInstance}
          onSlideChange={(swiper) => setActiveIndex(swiper.realIndex)}
          pagination={false}
          navigation={false}
          className="h-full w-full"
          style={{ overflow: 'hidden' }}
        >
          {cards.map((card, idx) => (
            <SwiperSlide 
              className="self-stretch h-full flex items-center justify-center"
              key={idx}
              style={{ width: '100%' }}
            >
              {card}
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
      {cards.length > 0 && swiperInstance && cards.length > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4 mt-auto">
          <button
            className="p-1.5 rounded-full bg-background/50 hover:bg-background/80 text-white transition-colors disabled:opacity-50"
            aria-label="Previous slide"
            onClick={() => swiperInstance?.slidePrev()}
            disabled={activeIndex === 0}
          >
            <ChevronLeftIcon />
          </button>
          <div className="flex gap-1.5">
            {cards.map((_, idx) => (
              <button
                key={idx}
                className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-semibold transition-colors
                  ${activeIndex === idx ? 'bg-primary text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                onClick={() => swiperInstance?.slideToLoop(idx)}
                aria-label={`Go to slide ${idx + 1}`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
          <button
            className="p-1.5 rounded-full bg-background/50 hover:bg-background/80 text-white transition-colors disabled:opacity-50"
            aria-label="Next slide"
            onClick={() => swiperInstance?.slideNext()}
            disabled={activeIndex === cards.length - 1}
          >
            <ChevronRightIcon />
          </button>
        </div>
      )}
    </div>
  );
}; 