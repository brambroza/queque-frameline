import type { UseCase } from '@/components/public/content';

export const useCasesEnBySlug: Record<string, Omit<UseCase, 'icon' | 'slug'>> = {
  'barber-shop': {
    title: 'Barber Shop',
    services: ['Men Haircut: Fixed Slot 30 mins', 'Hair Coloring: Flexible Duration 90-180 mins'],
    mode: 'Fixed Slot / Flexible Duration',
    summary: 'Perfect for mixed quick and long services while preventing schedule overlaps.',
  },
  clinic: {
    title: 'Clinic',
    services: ['General Checkup: Fixed Slot 15 mins', 'Specialist: Request Approval'],
    mode: 'Fixed Slot / Request Approval',
    summary: 'Manage both routine checkups and specialist visits that require confirmation.',
  },
  'nail-salon': {
    title: 'Nail Salon',
    services: ['Gel Nails', 'Nail Extensions'],
    mode: 'Fixed Slot',
    summary: 'Clear appointment slots for beauty services during busy peak hours.',
  },
  'mobile-repair': {
    title: 'Mobile Repair Shop',
    services: ['Device Diagnosis', 'Express Repair'],
    mode: 'Request Approval',
    summary: 'Receive diagnosis requests first and confirm repair jobs by technician availability.',
  },
  'car-service': {
    title: 'Car Service',
    services: ['Tire Replacement', 'Periodic Maintenance'],
    mode: 'Request Approval',
    summary: 'Queue vehicle jobs that require mechanic and spare-part confirmation.',
  },
  restaurant: {
    title: 'Restaurant',
    services: ['Table Reservation: Capacity Based', 'Walk-in: In-store Queue'],
    mode: 'Capacity Based / Walk-in',
    summary: 'Support table bookings and walk-in queue flows in parallel.',
  },
  'service-center': {
    title: 'Service Center',
    services: ['Service Request', 'On-site Queue'],
    mode: 'Fixed Slot',
    summary: 'Run multiple service types from one queue operations dashboard.',
  },
  government: {
    title: 'Government Office',
    services: ['Government Service Contact', 'Document Submission'],
    mode: 'Request Approval',
    summary: 'Reduce frontline crowding and route queue by service type.',
  },
  hospital: {
    title: 'Hospital',
    services: ['General OPD', 'Specialist Appointment'],
    mode: 'Fixed Slot / Request Approval',
    summary: 'Handle regular outpatient queues and specialist confirmation flow.',
  },
  consulting: {
    title: 'Consulting',
    services: ['Business Consultation', 'Project Planning'],
    mode: 'Flexible Duration',
    summary: 'Book flexible sessions based on case complexity.',
  },
  'installation-team': {
    title: 'Installation Team',
    services: ['CCTV Installation: Request Approval', 'Site Survey: Flexible Duration'],
    mode: 'Request Approval / Flexible Duration',
    summary: 'Plan site survey and installation queues with realistic time windows.',
  },
};

