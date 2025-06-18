module.exports = {
  isAdmin(member) {
    return member.permissions.has('Administrator');
  }
};
