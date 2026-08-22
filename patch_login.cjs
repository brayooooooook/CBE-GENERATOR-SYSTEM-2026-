const fs = require('fs');
const file = 'src/components/LoginPage.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both email address and password.');
      return;
    }`;

const replaceStr = `  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both email address and password.');
      return;
    }`;

content = content.replace(targetStr, replaceStr);

const targetStr2 = `  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg('Please enter your registered email address.');
      return;
    }`;

const replaceStr2 = `  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetLoading) return;
    if (!email.trim()) {
      setErrorMsg('Please enter your registered email address.');
      return;
    }`;

content = content.replace(targetStr2, replaceStr2);

fs.writeFileSync(file, content);
