const port = process.env.PORT || 3000;
// ... твой код ...
server.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});
