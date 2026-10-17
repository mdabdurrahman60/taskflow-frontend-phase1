// Sample employees. All names and emails are fictional (example domain).
// Each role has one "demo user" that the Demo Role Switcher logs in as.

export const DEMO_USER_BY_ROLE = {
  superadmin: 'u-kamal',
  admin: 'u-farhana',
  manager: 'u-imran',
  hr: 'u-maliha',
  support: 'u-arif',
  executive: 'u-ayesha',
}

const email = (first, last) => `${first}.${last}@taskflow.example`

export const MOCK_USERS = [
  // Operations
  { id: 'u-kamal', name: 'Kamal Hossain', email: email('kamal', 'hossain'), role: 'superadmin', title: 'Chief Operating Officer', departmentId: 'd-ops', managerId: null, status: 'Active', joinedOn: '2019-03-04' },
  { id: 'u-farhana', name: 'Farhana Rahman', email: email('farhana', 'rahman'), role: 'admin', title: 'Operations Administrator', departmentId: 'd-ops', managerId: 'u-kamal', status: 'Active', joinedOn: '2020-06-15', scopeDepartmentIds: ['d-ops', 'd-it', 'd-hr'] },
  { id: 'u-nabila', name: 'Nabila Karim', email: email('nabila', 'karim'), role: 'support', title: 'Facilities Coordinator', departmentId: 'd-ops', managerId: 'u-farhana', status: 'Active', joinedOn: '2022-01-10' },
  { id: 'u-sohel', name: 'Sohel Rana', email: email('sohel', 'rana'), role: 'executive', title: 'Operations Executive', departmentId: 'd-ops', managerId: 'u-farhana', status: 'Inactive', joinedOn: '2021-09-01' },

  // Marketing
  { id: 'u-imran', name: 'Imran Chowdhury', email: email('imran', 'chowdhury'), role: 'manager', title: 'Marketing Manager', departmentId: 'd-mkt', managerId: 'u-farhana', status: 'Active', joinedOn: '2020-02-17' },
  { id: 'u-ayesha', name: 'Ayesha Siddique', email: email('ayesha', 'siddique'), role: 'executive', title: 'Campaign Lead', departmentId: 'd-mkt', managerId: 'u-imran', status: 'Active', joinedOn: '2021-04-12' },
  { id: 'u-sarah', name: 'Sarah Ahmed', email: email('sarah', 'ahmed'), role: 'executive', title: 'Visual Designer', departmentId: 'd-mkt', managerId: 'u-imran', status: 'Active', joinedOn: '2022-07-05' },
  { id: 'u-rahim', name: 'Rahim Hasan', email: email('rahim', 'hasan'), role: 'executive', title: 'Content Writer', departmentId: 'd-mkt', managerId: 'u-imran', status: 'Active', joinedOn: '2022-10-24' },
  { id: 'u-tanvir', name: 'Tanvir Islam', email: email('tanvir', 'islam'), role: 'executive', title: 'Social Media Executive', departmentId: 'd-mkt', managerId: 'u-imran', status: 'Active', joinedOn: '2023-02-13' },
  { id: 'u-nusrat', name: 'Nusrat Jahan', email: email('nusrat', 'jahan'), role: 'executive', title: 'Brand Executive', departmentId: 'd-mkt', managerId: 'u-imran', status: 'Active', joinedOn: '2021-11-08' },

  // Engineering
  { id: 'u-mahmudul', name: 'Mahmudul Karim', email: email('mahmudul', 'karim'), role: 'manager', title: 'Engineering Manager', departmentId: 'd-eng', managerId: 'u-farhana', status: 'Active', joinedOn: '2019-08-19' },
  { id: 'u-shafiq', name: 'Shafiq Alam', email: email('shafiq', 'alam'), role: 'executive', title: 'Senior Software Engineer', departmentId: 'd-eng', managerId: 'u-mahmudul', status: 'Active', joinedOn: '2020-11-23' },
  { id: 'u-lamia', name: 'Lamia Akter', email: email('lamia', 'akter'), role: 'executive', title: 'QA Engineer', departmentId: 'd-eng', managerId: 'u-mahmudul', status: 'Active', joinedOn: '2022-03-28' },
  { id: 'u-rafi', name: 'Rafi Uddin', email: email('rafi', 'uddin'), role: 'executive', title: 'DevOps Engineer', departmentId: 'd-eng', managerId: 'u-mahmudul', status: 'Active', joinedOn: '2023-05-02' },

  // Finance
  { id: 'u-sabrina', name: 'Sabrina Haque', email: email('sabrina', 'haque'), role: 'manager', title: 'Finance Manager', departmentId: 'd-fin', managerId: 'u-farhana', status: 'Active', joinedOn: '2019-12-02' },
  { id: 'u-tahmid', name: 'Tahmid Rahman', email: email('tahmid', 'rahman'), role: 'executive', title: 'Financial Analyst', departmentId: 'd-fin', managerId: 'u-sabrina', status: 'On Leave', joinedOn: '2021-06-14' },
  { id: 'u-joya', name: 'Joya Das', email: email('joya', 'das'), role: 'executive', title: 'Accounts Executive', departmentId: 'd-fin', managerId: 'u-sabrina', status: 'Active', joinedOn: '2022-09-19' },

  // Human Resources
  { id: 'u-maliha', name: 'Maliha Sultana', email: email('maliha', 'sultana'), role: 'hr', title: 'HR Business Partner', departmentId: 'd-hr', managerId: 'u-farhana', status: 'Active', joinedOn: '2020-01-20' },
  { id: 'u-rubel', name: 'Rubel Mia', email: email('rubel', 'mia'), role: 'hr', title: 'Talent Acquisition Specialist', departmentId: 'd-hr', managerId: 'u-maliha', status: 'Active', joinedOn: '2023-01-16' },

  // IT Support
  { id: 'u-zubair', name: 'Zubair Khan', email: email('zubair', 'khan'), role: 'manager', title: 'IT Manager', departmentId: 'd-it', managerId: 'u-farhana', status: 'Active', joinedOn: '2019-10-07' },
  { id: 'u-arif', name: 'Arif Mahmud', email: email('arif', 'mahmud'), role: 'support', title: 'IT Support Specialist', departmentId: 'd-it', managerId: 'u-zubair', status: 'Active', joinedOn: '2021-02-22' },
  { id: 'u-tasnim', name: 'Tasnim Ferdous', email: email('tasnim', 'ferdous'), role: 'support', title: 'Systems Support Analyst', departmentId: 'd-it', managerId: 'u-zubair', status: 'Active', joinedOn: '2022-12-05' },
]
