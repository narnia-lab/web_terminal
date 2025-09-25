import React from 'react';
import { Container, Row, Col, Button } from 'react-bootstrap';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { projects } from '../projectsData';

const ProjectsSection = styled.section`
  padding: 6rem 0;
  background-color: var(--secondary-color);
`;

const SectionTitle = styled.h2`
  margin-bottom: 1rem;
`;

const Subtitle = styled.p`
  font-size: 1.2rem;
  color: var(--text-color-darker);
`;

const ProjectCard = styled(motion.div)`
  background: var(--glass-bg);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  border-radius: 25px;
  border: 1px solid var(--glass-border);
  padding: 1.5rem;
  height: 100%;
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;

  h4 {
    color: var(--text-color);
  }

  p {
    color: var(--text-color-darker);
  }

  &:hover {
    transform: translateY(-10px);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    border-color: var(--accent-color-1);
  }
`;

const StyledProjectButton = styled(Button)`
  background-color: rgba(255, 255, 255, 0.1);
  color: var(--text-color) !important;
  border: none;
  border-radius: 15px;
  padding: 0.8rem 2rem;
  font-weight: 700;
  font-size: 1rem;
  transition: all 0.3s ease;

  &:hover {
    background: linear-gradient(90deg, var(--accent-color-2), var(--accent-color-1));
    box-shadow: 0 0 20px rgba(0, 210, 255, 0.5);
    color: white !important;
  }
`;

const cardVariants = {
  offscreen: { y: 50, opacity: 0 },
  onscreen: { y: 0, opacity: 1, transition: { type: "spring", bounce: 0.4, duration: 0.8 } }
};

const Projects = () => {
  return (
    <ProjectsSection id="projects">
      <Container>
        <Row className="text-center mb-5">
          <Col>
            <SectionTitle className="gradient-text section-title">학생 작품</SectionTitle>
            <Subtitle>어린 학생들이 전문 개발자처럼 만들어낸 놀라운 결과물들을 만나보세요.</Subtitle>
          </Col>
        </Row>
        <Row xs={1} md={3} lg={5} className="g-3 justify-content-center">
          {projects.map((project, index) => (
            <Col key={index} xs={12} className="d-flex justify-content-center">
              <ProjectCard initial="offscreen" whileInView="onscreen" viewport={{ once: true, amount: 0.2 }} variants={cardVariants}>
                <h4 className="fw-bold gradient-text">{project.title}</h4>
                <p className="flex-grow-1">{project.description}</p>
                <p className="mb-2 text-muted">{project.student}</p>
                <StyledProjectButton href={project.link} target="_blank" rel="noopener noreferrer" className="mt-auto">
                  프로젝트 보기
                </StyledProjectButton>
              </ProjectCard>
            </Col>
          ))}
        </Row>
      </Container>
    </ProjectsSection>
  );
};

export default Projects;
