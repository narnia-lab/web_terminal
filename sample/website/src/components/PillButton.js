import styled from 'styled-components';
import { Button } from 'react-bootstrap';

const PillButton = styled(Button)`
  background: linear-gradient(90deg, var(--accent-color-2), var(--accent-color-1));
  border: none;
  color: white !important;
  padding: 0.6rem 1.8rem;
  border-radius: 999px;
  font-weight: 700;
  transition: all 0.3s ease;
  box-shadow: 0 0 20px rgba(0, 210, 255, 0.4);
  text-decoration: none;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 0 25px rgba(0, 210, 255, 0.6);
    color: white !important;
    text-decoration: underline;
  }
`;

export default PillButton;
