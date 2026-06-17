/* ============================================================
   ConnectifyU — Mock Authentication (auth.js)
   ============================================================ */

const auth = {
  // Pretend to get a secure token
  getToken: function() {
    return localStorage.getItem('cc_token');
  },

  // Pretend to log a user in
  login: function(event) {
    if (event) event.preventDefault(); // Stop the form from refreshing the page

    // For prototyping, we will check what email you typed in!
    const emailInput = document.getElementById('email');
    let role = 'student'; // Default role
    
    if (emailInput) {
      const email = emailInput.value.toLowerCase();
      // Magic emails just for testing your frontend!
      if (email.includes('admin')) role = 'admin';
      else if (email.includes('faculty')) role = 'faculty';
      else if (email.includes('organiser')) role = 'organiser';
    }

    // Save the mock login data
    localStorage.setItem('cc_token', 'mock-token-123');
    localStorage.setItem('role', role);
    
    alert(`Testing Mode: Logging you in as a ${role.toUpperCase()}`);

    // Route the user to the correct dashboard based on their role
    if (role === 'admin') {
      window.location.href = './admin.html';
    } else if (role === 'faculty') {
      window.location.href = './faculty-portal.html';
    } else if (role === 'organiser') {
      window.location.href = './organiser-dashboard.html';
    } else {
      window.location.href = './events.html'; // Regular student
    }
  },

  // Clear the token and redirect to login
  logout: function() {
    localStorage.removeItem('cc_token');
    localStorage.removeItem('role');
    
    if (window.location.pathname.includes('/pages/')) {
      window.location.href = './login.html';
    } else {
      window.location.href = './pages/login.html';
    }
  }
};