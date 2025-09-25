import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { FaQuestionCircle, FaLightbulb, FaProjectDiagram } from 'react-icons/fa';

const Section = styled.section`
  padding: 80px 0;
  background-color: var(--secondary-color);
`;

const FeatureCard = styled(motion.div)`
  background: var(--glass-bg);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  border-radius: 25px;
  border: var(--glass-border);
  padding: 2.5rem 2rem;
  text-align: center;
  height: 100%;

  h5 {
    color: var(--text-color);
  }

  @media (max-width: 768px) {
    padding: 2rem 1.5rem;
  }
`;

const IconWrapper = styled.div`
  font-size: 3rem;
  margin-bottom: 1.5rem;
  color: var(--accent-color-2);
`;

const features = [
  {
    icon: <FaQuestionCircle />,
    title: "교육 철학: 질문 만들기",
    description: "단순 코딩 기술이 아닌 '질문하는 힘'을 길러 AI를 지배하는 'Next-generation Architects'를 양성합니다. 'How'에서 'Why'와 'What if'로 질문을 확장하는 훈련을 통해 문제 해결 능력과 창의적 사고력을 향상시킵니다."
  },
  {
    icon: <FaProjectDiagram />,
    title: "교육 방식: AI-PBL",
    description: "AI 융합 프로젝트 기반 몰입형 학습(AI Integrated Project-based Immersive Learning)을 통해 학생들이 막연한 아이디어를 '똑똑한 질문'으로 발전시키는 실제적인 경험을 합니다."
  },
  {
    icon: <FaLightbulb />,
    title: "트랙 구분: Elite & Public",
    description: "소수 정예의 심화 실습 중심 'Elite Track'과 다수가 함께하며 체험과 기본기에 중점을 두는 'Public Track'으로 나뉘어 맞춤형 교육을 제공합니다."
  }
];

const cardVariants = {
  offscreen: { y: 50, opacity: 0 },
  onscreen: { y: 0, opacity: 1, transition: { type: "spring", bounce: 0.4, duration: 0.8 } }
};

const About = () => {
  return (
    <Section id="about">
      <Container>
        <Row className="text-center mb-5">
          <Col>
            <h2 className="gradient-text section-title">나니아랩 교육의 핵심</h2>
            <p className="lead text-white-50">우리는 단순한 코딩 기술이나 AI 사용법을 가르치지 않습니다.</p>
          </Col>
        </Row>
        <Row>
          {features.map((feature, index) => (
            <Col md={4} className="mb-4" key={index}>
              <FeatureCard initial="offscreen" whileInView="onscreen" viewport={{ once: true, amount: 0.5 }} variants={cardVariants}>
                <IconWrapper>{feature.icon}</IconWrapper>
                <h5>{feature.title}</h5>
                <p className="text-white-50">{feature.description}</p>
              </FeatureCard>
            </Col>
          ))}
        </Row>
      </Container>
    </Section>
  );
};

export default About;
