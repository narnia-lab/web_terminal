import React from 'react';
import { Helmet } from 'react-helmet-async';
import Header from './components/Header';
import Hero from './components/Hero';
import About from './components/About';
import Camps from './components/Camps';
import Projects from './components/Projects';
import Footer from './components/Footer';
import { RiKakaoTalkFill } from 'react-icons/ri';
import './App.css';

function App() {
  return (
    <div className="App">
      <Helmet>
        <title>나니아랩 | AI 엔지니어 교육</title>
        <meta
          name="description"
          content="나니아랩 AI 엔지니어 교육: 정답 찾기에서 '질문 만들기'로, AI를 지배하는 인재를 양성합니다."
        />
        <link rel="canonical" href="https://narnia-lab.github.io/home" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="나니아랩 | AI 엔지니어 교육" />
        <meta property="og:description" content="나니아랩 AI 엔지니어 교육: 정답 찾기에서 '질문 만들기'로, AI를 지배하는 인재를 양성합니다." />
        <meta property="og:image" content="https://narnia-lab.github.io/home/logo.jpg" />
        <meta property="og:url" content="https://narnia-lab.github.io/home" />
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:title" content="나니아랩 | AI 엔지니어 교육" />
        <meta property="twitter:description" content="나니아랩 AI 엔지니어 교육: 정답 찾기에서 '질문 만들기'로, AI를 지배하는 인재를 양성합니다." />
        <meta property="twitter:image" content="https://narnia-lab.github.io/home/logo.jpg" />
      </Helmet>
      <Header />
      <main>
        <Hero />
        <About />
        <Camps />
        <Projects />
      </main>
      <Footer />
      <a 
        href="http://pf.kakao.com/_DZhmn" 
        target="_blank" 
        rel="noopener noreferrer"
        className="floating-kakao-button"
        aria-label="카카오톡 채널로 문의하기"
      >
        <RiKakaoTalkFill />
        <span>문의하기</span>
      </a>
    </div>
  );
}

export default App;
