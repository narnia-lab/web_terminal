import React, { useCallback } from 'react';
import { Container } from 'react-bootstrap';
import styled from 'styled-components';
import Particles from "react-tsparticles";
import { loadFull } from "tsparticles";
import PillButton from './PillButton';

const HeroSection = styled.section`
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  position: relative;
  padding: 0;
  background-color: var(--primary-color);
`;

const ParticlesWrapper = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;

  canvas {
    background-color: transparent !important;
  }
`;

const ContentWrapper = styled(Container)`
  position: relative;
  z-index: 2;
  
  h1 {
    font-size: 4.5rem;
    font-weight: 700;
    text-shadow: 0 4px 15px rgba(0,0,0,0.4);
  }

  p {
    font-size: 1.5rem;
    color: var(--text-color-darker);
    margin: 1.5rem 0 2.5rem;
    text-shadow: 0 2px 8px rgba(0,0,0,0.4);
    font-weight: 600;
  }

  @media (max-width: 768px) {
    h1 {
      font-size: 2.5rem;
    }
    p {
      font-size: 1.1rem;
    }
  }
`;

const ButtonWrapper = styled.div`
  display: flex;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
`;

const Hero = () => {
  const particlesInit = useCallback(async engine => {
    await loadFull(engine);
  }, []);

  return (
    <HeroSection id="home">
      <ParticlesWrapper>
        <Particles
          id="tsparticles"
          init={particlesInit}
          options={{
            background: {
              color: {
                value: 'transparent',
              },
            },
            fpsLimit: 60,
            interactivity: {
              events: {
                onHover: { enable: true, mode: "repulse" },
                resize: true,
              },
              modes: {
                repulse: { distance: 100, duration: 0.4 },
              },
            },
            particles: {
              color: { value: "#ffffff" },
              links: { color: "#ffffff", distance: 150, enable: true, opacity: 0.1, width: 1 },
              move: { direction: "none", enable: true, outModes: { default: "bounce" }, random: false, speed: 1, straight: false },
              number: { density: { enable: true, area: 800 }, value: 80 },
              opacity: { value: 0.2 },
              shape: { type: "circle" },
              size: { value: { min: 1, max: 3 } },
            },
            detectRetina: true,
          }}
        />
      </ParticlesWrapper>
      <ContentWrapper>
        <h1 className="gradient-text">나니아랩 AI 엔지니어 교육</h1>
        <p>정답 찾기에서 '질문 만들기'로, AI를 지배하는 인재를 양성합니다.</p>
        <ButtonWrapper>
          <PillButton size="lg" href="#camps">커리큘럼 바로가기</PillButton>
        </ButtonWrapper>
      </ContentWrapper>
    </HeroSection>
  );
};

export default Hero;
