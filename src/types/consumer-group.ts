// Consumer group types
export interface ConsumerGroupInfo {
  group_id: string;
  state: string;
  protocol_type: string;
  coordinator: number;
  members: ConsumerGroupMember[];
  offsets: ConsumerGroupOffset[];
}

export interface ConsumerGroupMember {
  member_id: string;
  client_id: string;
  host: string;
  assignments: { topic: string; partitions: number[] }[];
}

export interface ConsumerGroupOffset {
  topic: string;
  partition: number;
  current_offset: number;
  log_end_offset: number;
  lag: number;
}
