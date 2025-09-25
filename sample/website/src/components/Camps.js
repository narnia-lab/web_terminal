import React, { useState } from 'react';
import { Container, Row, Col, ButtonGroup, Button, Accordion } from 'react-bootstrap';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { campsData } from '../data';
import { FaCheckCircle } from 'react-icons/fa';

const Section = styled.section`
  padding: 5rem 0;
  background-color: var(--primary-color);
`;

const TrackSelector = styled(ButtonGroup)`
  margin-bottom: 3rem;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
  border-radius: 999px;
  
  .btn {
    border-radius: 999px !important;
    padding: 0.8rem 2rem;
    font-weight: 700;
    font-size: 1.1rem;
    border: none;
    transition: all 0.3s ease;
    
    &.active {
      background: linear-gradient(90deg, var(--accent-color-2), var(--accent-color-1));
      color: white;
      box-shadow: 0 0 20px rgba(0, 210, 255, 0.5);
    }
    
    &.inactive {
      background-color: rgba(255, 255, 255, 0.1);
      color: var(--text-color);
    }
  }
`;

const CampCard = styled(motion.div)`
  background: var(--glass-bg);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  border-radius: 25px;
  border: 1px solid var(--glass-border);
  padding: 2.5rem;
  height: 100%;
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-10px);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    border-color: var(--accent-color-1);
  }

  h4, h5, h4 + p {
    color: var(--text-color);
  }

  p {
    color: var(--text-color-darker);
  }

  p strong {
    color: var(--text-color);
    font-weight: 700;
  }

  @media (max-width: 768px) {
    padding: 2rem;
  }
`;

const CardBody = styled.div`
  flex-grow: 1;
  text-align: left;
`;

const StyledAccordion = styled(Accordion)`
  .accordion-item {
    background-color: rgba(0,0,0,0.2);
    border-radius: 15px !important;
    border: none;
    margin-bottom: 0.5rem;
  }
  
  .accordion-header button {
    background-color: transparent;
    color: var(--text-color);
    font-weight: bold;
    border-radius: 15px !important;
    
    &:not(.collapsed) {
      color: var(--accent-color-1);
      box-shadow: none;
    }
    
    &::after {
      filter: brightness(0) invert(1);
    }
  }
  
  .accordion-body {
    color: var(--text-color-darker);
    padding: 1rem 1.5rem;
  }
`;

const DetailList = styled.ul`
  list-style-type: none;
  padding-left: 0;
  
  li {
    display: flex;
    align-items: flex-start;
    margin-bottom: 0.5rem;
  }
  
  svg {
    color: var(--accent-color-2);
    margin-right: 0.75rem;
    margin-top: 0.25rem;
    flex-shrink: 0;
  }
`;

const cardVariants = {
  offscreen: { y: 50, opacity: 0 },
  onscreen: { y: 0, opacity: 1, transition: { type: "spring", bounce: 0.4, duration: 0.8 } }
};

const Camps = () => {
  const [activeTrack, setActiveTrack] = useState('public');

  const filteredCamps = campsData.filter(camp => camp.track === activeTrack);

  return (
    <Section id="camps">
      <Container>
        <Row className="text-center mb-5">
          <Col>
            <h2 className="gradient-text section-title">교육 커리큘럼</h2>
            <p className="lead text-white-50">Elite 트랙과 Public 트랙으로 구성된 체계적인 커리큘럼을 만나보세요.</p>
            <TrackSelector>
              <Button 
                className={activeTrack === 'public' ? 'active' : 'inactive'} 
                onClick={() => setActiveTrack('public')}
              >
                🌍 Public Track
              </Button>
              <Button 
                className={activeTrack === 'elite' ? 'active' : 'inactive'} 
                onClick={() => setActiveTrack('elite')}
              >
                🚀 Elite Track
              </Button>
            </TrackSelector>
          </Col>
        </Row>
        <Row>
          {filteredCamps.map(camp => (
            <Col lg={6} className="mb-4" key={camp.id}>
              <CampCard initial="offscreen" whileInView="onscreen" viewport={{ once: true, amount: 0.2 }} variants={cardVariants}>
                <CardBody>
                  <h4 className="gradient-text">{camp.title}</h4>
                  <p><strong>테마:</strong> {camp.theme}</p>
                  <p><strong>프로젝트:</strong> {camp.project}</p>
                  <p><strong>대상:</strong> {camp.target}</p>
                  <p className="text-white-50">{camp.goal}</p>
                  <hr style={{ borderColor: "rgba(255, 255, 255, 0.3)" }} />
                  <h5 className="mt-4 mb-3">차시별 진행 계획</h5>
                  {camp.schedules && camp.schedules.length > 0 ? (
                    <StyledAccordion>
                      {camp.schedules.map((schedule, index) => (
                        <Accordion.Item eventKey={String(index)} key={schedule.id}>
                          <Accordion.Header>{schedule.name}</Accordion.Header>
                          <Accordion.Body>
                            <DetailList>
                              {schedule.details.map((detail, i) => (
                                <li key={i}><FaCheckCircle /><span>{detail}</span></li>
                              ))}
                            </DetailList>
                          </Accordion.Body>
                        </Accordion.Item>
                      ))}
                    </StyledAccordion>
                  ) : (
                    <p className="text-white-50">세부 계획이 없습니다.</p>
                  )}
                </CardBody>
              </CampCard>
            </Col>
          ))}
        </Row>
      </Container>
    </Section>
  );
};

export default Camps;
