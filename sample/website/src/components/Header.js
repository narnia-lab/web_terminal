import React, { useState, useEffect } from 'react';
import { Navbar, Container, Nav } from 'react-bootstrap';
import styled from 'styled-components';

const StyledNavbar = styled(Navbar)`
  transition: all 0.3s ease-out;
  background: ${({ scrolled }) => (scrolled ? 'var(--glass-bg)' : 'transparent')};
  backdrop-filter: ${({ scrolled }) => (scrolled ? 'blur(10px)' : 'none')};
  -webkit-backdrop-filter: ${({ scrolled }) => (scrolled ? 'blur(10px)' : 'none')};
  border-bottom: ${({ scrolled }) => (scrolled ? 'var(--glass-border)' : 'none')};

  .navbar-brand, .nav-link {
    color: var(--text-color) !important;
    font-weight: 600;
    transition: color 0.2s ease;
    text-shadow: 0 1px 3px rgba(0,0,0,0.2);
  }

  .nav-link:hover {
    color: var(--accent-color-1) !important;
  }
  
  .navbar-brand {
    display: flex;
    align-items: center;
    font-weight: 700;
  }

  .navbar-brand img {
    height: 40px;
    margin-right: 10px;
  }

  @media (max-width: 991.98px) {
    .navbar-collapse {
      background: var(--glass-bg);
      border-radius: 15px;
      padding: 1rem;
      margin-top: 1rem;
      border: var(--glass-border);
    }
    .navbar-nav {
      align-items: flex-end;
    }
    .nav-link {
      padding: 0.5rem 0;
    }
  }
`;

const Header = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <StyledNavbar scrolled={scrolled.toString()} expand="lg" fixed="top">
      <Container>
        <Navbar.Brand href="#home" className="gradient-text">
          NARNIA LAB
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="ms-auto">
            <Nav.Link href="#about">교육 핵심</Nav.Link>
            <Nav.Link href="#camps">커리큘럼</Nav.Link>
            <Nav.Link href="#projects">학생 작품</Nav.Link>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </StyledNavbar>
  );
};

export default Header;
